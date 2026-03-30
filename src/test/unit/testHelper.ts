import * as assert from 'assert';
import * as sinon from 'sinon';

// The vscode mock is registered by setup.js (loaded via --require before mocha runs).
// This file just re-exports test utilities for convenience.
const vscodeStub = (global as any).__vscodeStub as Record<string, unknown>;

export { vscodeStub, assert, sinon };
