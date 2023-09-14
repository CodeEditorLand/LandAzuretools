/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtPipelineResponse } from '@microsoft/vscode-azext-azureutils';
import { AzExtFsExtra, IActionContext } from '@microsoft/vscode-azext-utils';
import * as globby from 'globby';
import * as path from 'path';
import * as prettybytes from 'pretty-bytes';
import * as vscode from 'vscode';
import { ParsedSite } from '../SiteClient';
import { ext } from '../extensionVariables';
import { getFileExtension } from '../utils/pathUtils';
import JSZip = require('jszip');


export async function runWithZipStream(context: IActionContext, options: {
    fsPath: string,
    site: ParsedSite,
    pathFileMap?: Map<string, string>,
    progress?: vscode.Progress<number>
    callback: (zipStream: ReadableStream | Blob) => Promise<AzExtPipelineResponse | void>
}): Promise<AzExtPipelineResponse | void> {

    function onFileSize(size: number): void {
        context.telemetry.measurements.zipFileSize = size;
        ext.outputChannel.appendLog(vscode.l10n.t('Zip package size: {0}', prettybytes(size)), { resourceName: site.fullName });
    }

    const { site, pathFileMap, callback } = options;
    let { fsPath } = options;

    if (getFileExtension(fsPath) === 'zip') {
        context.telemetry.properties.alreadyZipped = 'true';
        // TODO

        // don't wait
        void vscode.workspace.fs.stat(vscode.Uri.file(fsPath)).then(stats => {
            onFileSize(stats.size);
        });
    } else {
        ext.outputChannel.appendLog(vscode.l10n.t('Creating zip package...'), { resourceName: site.fullName });
        const zipFile: JSZip = new JSZip();
        let filesToZip: string[] = [];
        // let sizeOfZipFile: number = 0;

        if (await AzExtFsExtra.isDirectory(fsPath)) {
            if (!fsPath.endsWith(path.sep)) {
                fsPath += path.sep;
            }

            if (site.isFunctionApp) {
                filesToZip = await getFilesFromGitignore(fsPath, '.funcignore');
            } else {
                filesToZip = await getFilesFromGlob(fsPath, site);
            }

            for (const file of filesToZip) {
                const uri = vscode.Uri.file(file);
                zipFile.file(getPathFromMap(file, pathFileMap), await vscode.workspace.fs.readFile(uri));
            }
        } else {
            const uri = vscode.Uri.file(fsPath);
            zipFile.file(getPathFromMap(path.basename(fsPath), pathFileMap), await vscode.workspace.fs.readFile(uri));
        }


        const browserStream = await zipFile.generateAsync({
            compression: 'DEFLATE',
            type: 'blob',
            // 1 is fastest
            compressionOptions: { level: 1 },
            streamFiles: true
        }, metadata => {
            options.progress?.report(metadata.percent)
        });


        // const zipStream = zipFile.generateNodeStream({
        //     compression: 'DEFLATE',
        //     // 1 is fastest
        //     compressionOptions: { level: 1 },
        //     streamFiles: true
        // }, metadata => {
        //     ext.outputChannel.appendLog(vscode.l10n.t('Zipping file {0}, progress {1}%', String(metadata.currentFile), metadata.percent), { resourceName: site.fullName });
        // });

        // zipStream.on('data', (chunk) => {
        //     if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
        //         sizeOfZipFile += chunk.length;
        //     }
        // });

        // zipStream.on('end', () => onFileSize(sizeOfZipFile));

        await callback(browserStream);
    }
}

function getPathFromMap(realPath: string, pathfileMap?: Map<string, string>): string {
    realPath = pathfileMap?.get(realPath) || realPath;
    if (realPath.startsWith('/')) {
        // remove preceding slash
        realPath = realPath.slice(1);
    }

    return realPath;
}

const commonGlobSettings: Partial<globby.GlobbyOptions> = {
    dot: true, // Include paths starting with '.'
    followSymbolicLinks: true, // Follow symlinks to get all sub folders https://github.com/microsoft/vscode-azurefunctions/issues/1289
};

/**
 * Adds files using glob filtering
 */
async function getFilesFromGlob(folderPath: string, site: ParsedSite): Promise<string[]> {
    const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(ext.prefix, vscode.Uri.file(folderPath));
    const globOptions = { cwd: folderPath, followSymbolicLinks: true, dot: true };
    const globPattern: string = zipDeployConfig.get<string>('zipGlobPattern') || '**/*';
    const filesToInclude: string[] = await globby(globPattern, globOptions);
    const zipIgnorePatternStr = 'zipIgnorePattern';

    let ignorePatternList: string | string[] = zipDeployConfig.get<string | string[]>(zipIgnorePatternStr) || '';
    const filesToIgnore: string[] = await globby(ignorePatternList, globOptions);

    if (ignorePatternList) {
        if (typeof ignorePatternList === 'string') {
            ignorePatternList = [ignorePatternList];
        }
        if (ignorePatternList.length > 0) {
            ext.outputChannel.appendLog(vscode.l10n.t(`Ignoring files from \"{0}.{1}\"`, ext.prefix, zipIgnorePatternStr), { resourceName: site.fullName });
            for (const pattern of ignorePatternList) {
                ext.outputChannel.appendLine(`\"${pattern}\"`);
            }
        }
    }

    return filesToInclude.filter(file => {
        return !filesToIgnore.includes(file);
    })
}

/**
 * Adds files using gitignore filtering
 */
async function getFilesFromGitignore(folderPath: string, gitignoreName: string): Promise<string[]> {
    let ignore: string[] = [];
    const gitignorePath: string = path.join(folderPath, gitignoreName);
    if (await AzExtFsExtra.pathExists(gitignorePath)) {
        const funcIgnoreContents: string = (await AzExtFsExtra.readFile(gitignorePath)).toString();
        ignore = funcIgnoreContents
            .split('\n')
            .map(l => l.trim())
            .filter(s => s !== '');
    }

    return await globby('**/*', {
        // We can replace this option and the above logic with `ignoreFiles` if we upgrade to globby^13 (ESM)
        // see https://github.com/sindresorhus/globby#ignorefiles
        ignore,
        cwd: folderPath,
        ...commonGlobSettings
    });
}
