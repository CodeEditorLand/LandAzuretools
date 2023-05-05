/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtPipelineResponse } from '@microsoft/vscode-azext-azureutils';
import { AzExtFsExtra, IActionContext } from '@microsoft/vscode-azext-utils';
<<<<<<< Updated upstream
import * as globby from 'globby';
=======
>>>>>>> Stashed changes
import * as path from 'path';
import * as prettybytes from 'pretty-bytes';
import * as vscode from 'vscode';
<<<<<<< Updated upstream
import * as yazl from 'yazl';
import { ParsedSite } from '../SiteClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
=======
import { ParsedSite } from '../SiteClient';
import { ext } from '../extensionVariables';
>>>>>>> Stashed changes
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
        ext.outputChannel.appendLog(localize('zipSize', 'Zip package size: {0}', prettybytes(size)), { resourceName: site.fullName });
    }

    const { site, pathFileMap, callback } = options;
    let { fsPath } = options;
    const uri = vscode.Uri.file(fsPath);

    if (getFileExtension(fsPath) === 'zip') {
        context.telemetry.properties.alreadyZipped = 'true';
<<<<<<< Updated upstream
        zipStream = Readable.from(await AzExtFsExtra.readFile(fsPath));

        // don't wait
        void (vscode.workspace.fs.stat(uri)).then(stats => {
            onFileSize(stats.size);
        });
    } else {
        ext.outputChannel.appendLog(localize('zipCreate', 'Creating zip package...'), { resourceName: site.fullName });
        const zipFile: yazl.ZipFile = new yazl.ZipFile();
=======
        // TODO

        // don't wait
        void vscode.workspace.fs.stat(vscode.Uri.file(fsPath)).then(stats => {
            onFileSize(stats.size);
        });
    } else {
        ext.outputChannel.appendLog(vscode.l10n.t('Creating zip package...'), { resourceName: site.fullName });
        const zipFile: JSZip = new JSZip();
>>>>>>> Stashed changes
        let filesToZip: string[] = [];
        // let sizeOfZipFile: number = 0;

<<<<<<< Updated upstream
        zipFile.outputStream.on('data', (chunk) => {
            if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
                sizeOfZipFile += chunk.length;
            }
        });

        zipFile.outputStream.on('finish', () => onFileSize(sizeOfZipFile));

        if ((await vscode.workspace.fs.stat(uri)).type === vscode.FileType.Directory) {
=======
        if (await AzExtFsExtra.isDirectory(fsPath)) {
>>>>>>> Stashed changes
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

/**
 * Adds files using glob filtering
 */
async function getFilesFromGlob(folderPath: string, site: ParsedSite): Promise<string[]> {
    const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(ext.prefix, vscode.Uri.file(folderPath));
    const globPattern: string = zipDeployConfig.get<string>('zipGlobPattern') || '**/*';
    const filesToInclude: string[] = (await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, globPattern))).map(f => f.path);
    const zipIgnorePatternStr = 'zipIgnorePattern';

    let ignorePatternList: string | string[] = zipDeployConfig.get<string | string[]>(zipIgnorePatternStr) || '';

    const filesToIgnore = await generateIgnoreFiles(folderPath, ignorePatternList)
    if (ignorePatternList) {
        if (typeof ignorePatternList === 'string') {
            ignorePatternList = [ignorePatternList];
        }


        if (ignorePatternList.length > 0) {
            ext.outputChannel.appendLog(localize('zipIgnoreFileMsg', `Ignoring files from \"{0}.{1}\"`, ext.prefix, zipIgnorePatternStr), { resourceName: site.fullName });
            for (const pattern of ignorePatternList) {
                ext.outputChannel.appendLine(`\"${pattern}\"`);
            }
        }
    }

    // this doesn't work due to slash differences
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
<<<<<<< Updated upstream
        const funcIgnoreContents: string = (await AzExtFsExtra.readFile(gitignorePath)).toString();
=======
        const funcIgnoreContents: string = await AzExtFsExtra.readFile(gitignorePath);
>>>>>>> Stashed changes
        ignore = funcIgnoreContents.split('\n').map(l => l.trim());
    }

    return await generateIgnoreFiles(folderPath, ignore);
}

async function generateIgnoreFiles(folderPath: string, ignorePatternList: string | string[]): Promise<string[]> {
    ignorePatternList = Array.isArray(ignorePatternList) ? ignorePatternList : [ignorePatternList];
    const filesToIgnore = new Set<string>();
    for (const pattern of ignorePatternList) {
        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, pattern));
        for (const file of files) {
            filesToIgnore.add(file.fsPath);
        }
    }

    return Array.from(filesToIgnore);
}
