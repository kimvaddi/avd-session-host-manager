import { assert } from './testHelper';

describe('Image Template Generation Tests', () => {

    describe('Packer Template Generation', () => {
        it('should generate valid HCL with FSLogix provisioner', () => {
            const { ImageCommands } = require('../../commands/imageCommands');
            const cmds = new ImageCommands();

            // Access private method via bracket notation for testing
            const template = (cmds as any).generatePackerTemplate(
                { osVersion: 'win11-24h2-avd', osLabel: 'Windows 11 24H2', features: ['fslogix'] },
                'hp-test'
            );

            assert.ok(template.includes('source "azure-arm" "avd"'), 'Should contain azure-arm source block');
            assert.ok(template.includes('win11-24h2-avd'), 'Should contain correct SKU');
            assert.ok(template.includes('FSLogix'), 'Should contain FSLogix provisioner');
            assert.ok(template.includes('hp-test'), 'Should reference host pool name');
            assert.ok(template.includes('Sysprep'), 'Should contain sysprep generalization');
        });

        it('should generate template with Teams optimization', () => {
            const { ImageCommands } = require('../../commands/imageCommands');
            const cmds = new ImageCommands();

            const template = (cmds as any).generatePackerTemplate(
                { osVersion: 'win11-23h2-avd', osLabel: 'Windows 11 23H2', features: ['teams'] },
                undefined
            );

            assert.ok(template.includes('IsWVDEnvironment'), 'Should set WVD environment registry key');
            assert.ok(template.includes('teamsbootstrapper'), 'Should install Teams bootstrapper');
        });

        it('should include Windows Update provisioner when selected', () => {
            const { ImageCommands } = require('../../commands/imageCommands');
            const cmds = new ImageCommands();

            const template = (cmds as any).generatePackerTemplate(
                { osVersion: 'win11-24h2-avd', osLabel: 'Test', features: ['windowsupdate'] },
                undefined
            );

            assert.ok(template.includes('windows-update'), 'Should contain windows-update provisioner');
            assert.ok(template.includes('Preview'), 'Should exclude Preview updates');
        });

        it('should handle multiple features combined', () => {
            const { ImageCommands } = require('../../commands/imageCommands');
            const cmds = new ImageCommands();

            const template = (cmds as any).generatePackerTemplate(
                { osVersion: 'win11-24h2-avd', osLabel: 'Test', features: ['fslogix', 'teams', 'msixappattach', 'windowsupdate'] },
                'hp-multi'
            );

            assert.ok(template.includes('FSLogix'), 'Should have FSLogix');
            assert.ok(template.includes('IsWVDEnvironment'), 'Should have Teams');
            assert.ok(template.includes('Hyper-V'), 'Should have MSIX app attach');
            assert.ok(template.includes('windows-update'), 'Should have Windows Update');
        });

        it('should generate template with no features (base image only)', () => {
            const { ImageCommands } = require('../../commands/imageCommands');
            const cmds = new ImageCommands();

            const template = (cmds as any).generatePackerTemplate(
                { osVersion: 'win10-22h2-avd', osLabel: 'Windows 10 22H2', features: [] },
                undefined
            );

            assert.ok(template.includes('source "azure-arm" "avd"'), 'Should have base source block');
            assert.ok(template.includes('Sysprep'), 'Should still have sysprep');
        });
    });

    describe('Azure Image Builder Template Generation', () => {
        it('should generate valid JSON with FSLogix customizer', () => {
            const { ImageCommands } = require('../../commands/imageCommands');
            const cmds = new ImageCommands();

            const templateStr = (cmds as any).generateAIBTemplate(
                { osVersion: 'win11-24h2-avd', osLabel: 'Windows 11 24H2', features: ['fslogix'] },
                'hp-aib'
            );

            // Ensure valid JSON
            const template = JSON.parse(templateStr);
            assert.ok(template.$schema, 'Should have ARM schema');
            assert.ok(template.resources.length > 0, 'Should have resources');

            const customizers = template.resources[0].properties.customize;
            const fslogixStep = customizers.find((c: any) => c.name === 'InstallFSLogix');
            assert.ok(fslogixStep, 'Should have FSLogix customizer');
            assert.strictEqual(fslogixStep.type, 'PowerShell');
        });

        it('should include WindowsRestart customizer at end', () => {
            const { ImageCommands } = require('../../commands/imageCommands');
            const cmds = new ImageCommands();

            const templateStr = (cmds as any).generateAIBTemplate(
                { osVersion: 'win11-24h2-avd', osLabel: 'Test', features: ['fslogix'] },
                undefined
            );

            const template = JSON.parse(templateStr);
            const customizers = template.resources[0].properties.customize;
            const lastCustomizer = customizers[customizers.length - 1];
            assert.strictEqual(lastCustomizer.type, 'WindowsRestart', 'Last customizer should be WindowsRestart');
        });

        it('should generate valid JSON with all features', () => {
            const { ImageCommands } = require('../../commands/imageCommands');
            const cmds = new ImageCommands();

            const templateStr = (cmds as any).generateAIBTemplate(
                {
                    osVersion: 'win11-24h2-avd',
                    osLabel: 'Test',
                    features: ['fslogix', 'teams', 'langpacks', 'msixappattach', 'windowsupdate'],
                },
                undefined
            );

            const template = JSON.parse(templateStr);
            assert.ok(template, 'Should parse as valid JSON');

            const customizers = template.resources[0].properties.customize;
            assert.ok(customizers.length >= 5, `Should have at least 5 customizers, got ${customizers.length}`);
        });
    });
});
