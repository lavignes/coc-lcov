import parse from 'lcov-parse';
import { commands, ExtensionContext, Disposable, Uri, watchFile, workspace, window } from 'coc.nvim';
import path from 'path';
import fs from 'fs';

let watcher: Disposable | undefined = undefined;
const cachedFiles: Map<string, LcovFile> = new Map();

interface LcovLineDetails {
    line: number,
    hit: number,
}

interface LcovLines {
    details: LcovLineDetails[],
}

interface LcovFile {
    file: string,
    lines: LcovLines,
}

export async function activate(context: ExtensionContext): Promise<void> {
    const config = workspace.getConfiguration('lcov');
    const enabled = config.get<boolean>('enabled', true);
    if (!enabled) {
        return;
    }

    const reportPath = config.get<string>('reportPath', 'target/debug/lcov.info');
    const negativeSign = config.get<string>('uncoveredSign.uncovered', '█');
    const positiveSign = config.get<string>('uncoveredSign.covered', '█');
    const missingBranch = config.get<string>('uncoveredSign.missingBranch', '█');

    workspace.nvim.command(`sign define CocLcovUncovered text=${negativeSign} texthl=Error`, true);
    workspace.nvim.command(`sign define CocLcovCovered text=${positiveSign} texthl=Statement`, true);
    workspace.nvim.command(`sign define CocLcovMissingBranch text=${missingBranch} texthl=WarningMsg`, true);

    tryWatch(reportPath);

    context.subscriptions.push(
        workspace.registerAutocmd({
            event: ['BufEnter'],
            callback: refresh,
        }),
        commands.registerCommand('lcov.refresh', refresh)
    );
}

function tryWatch(reportPath: string) {
    if (watcher) {
        return;
    }
    if (!fs.existsSync(reportPath)) {
        setTimeout(() => tryWatch(reportPath), 5000);
        return;
    }
    watcher = watchFile(reportPath, () => {
        onCoverageUpdate(reportPath);
    }, true);
}

export async function deactivate(): Promise<void> {
    if (watcher) {
        watcher.dispose();
    }
}

function onCoverageUpdate(reportPath: string) {
    parse(reportPath, (err, files: LcovFile[]) => {
        if (err) {
            window.showErrorMessage(`Could not parse ${reportPath}: ${err}`);
            return;
        }
        cachedFiles.clear();
        for (const file of files) {
            if (!file.file) {
                continue;
            }
            cachedFiles.set(file.file, file);
        }
        refresh();
    });
}

async function refresh() {
    const doc = await workspace.document;
    let docPath: string;
    try {
        docPath = fs.realpathSync(Uri.parse(doc.uri).fsPath);
    } catch (e) {
        return;
    }

    const file = cachedFiles.get(docPath);
    if (!file) {
        return;
    }

    workspace.nvim.pauseNotification();

    workspace.nvim.call('sign_unplace', ['CocLcov', { buffer: doc.bufnr }], true);
    for (const line of file.lines.details) {
        const sign = (line.hit == 0) ? 'CocLcovUncovered' : 'CocLcovCovered';
        workspace.nvim.call('sign_place', [0, 'CocLcov', sign, doc.bufnr, { lnum: line.line, priority: 10 }], true);
    }

    workspace.nvim.resumeNotification(false, true);
}
