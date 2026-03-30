import * as path from 'path';
import Mocha from 'mocha';
import * as fs from 'fs';

export function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 10000 });
    const testsRoot = path.resolve(__dirname, '.');

    return new Promise((resolve, reject) => {
        // Find all test files
        const fs = require('fs');
        const testFiles = fs.readdirSync(testsRoot)
            .filter((f: string) => f.endsWith('.test.js'))
            .map((f: string) => path.resolve(testsRoot, f));

        testFiles.forEach((f: string) => mocha.addFile(f));

        try {
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}
