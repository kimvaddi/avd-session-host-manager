// This file must be loaded via --require BEFORE any test file.
// It patches Module._load to intercept 'vscode' require calls.
const Module = require('module');
const sinon = require('sinon');

const vscodeStub = {
    TreeItem: class {
        constructor(label, collapsibleState) {
            this.label = label;
            this.collapsibleState = collapsibleState ?? 0;
        }
    },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: class {
        constructor(id, color) {
            this.id = id;
            this.color = color;
        }
    },
    ThemeColor: class {
        constructor(id) {
            this.id = id;
        }
    },
    MarkdownString: class {
        constructor(value) {
            this.value = value;
        }
    },
    EventEmitter: class {
        fire() {}
        get event() { return () => {}; }
    },
    Uri: {
        parse: (s) => ({ toString: () => s }),
    },
    window: {
        showInformationMessage: sinon.stub(),
        showErrorMessage: sinon.stub(),
        showWarningMessage: sinon.stub(),
        showQuickPick: sinon.stub(),
        showInputBox: sinon.stub(),
        createTreeView: sinon.stub().returns({ dispose: () => {} }),
        createWebviewPanel: sinon.stub().returns({ webview: { html: '' }, dispose: () => {} }),
        withProgress: sinon.stub().callsFake((_opts, task) => task()),
    },
    commands: {
        registerCommand: sinon.stub().returns({ dispose: () => {} }),
        executeCommand: sinon.stub(),
    },
    env: {
        clipboard: { writeText: sinon.stub() },
        openExternal: sinon.stub(),
    },
    workspace: {
        openTextDocument: sinon.stub().resolves({}),
    },
    extensions: {
        getExtension: sinon.stub(),
    },
    authentication: {
        getSession: sinon.stub().resolves({ accessToken: 'mock-token', account: { label: 'user@contoso.com', id: '123' }, id: 'sess1', scopes: [] }),
    },
    ProgressLocation: { Notification: 15 },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === 'vscode') {
        return vscodeStub;
    }
    return originalLoad.call(this, request, parent, isMain);
};

global.__vscodeStub = vscodeStub;
