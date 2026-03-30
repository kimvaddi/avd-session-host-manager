import { assert } from './testHelper';

describe('Scaling Plan Bicep Generation Tests', () => {

    describe('ScalingCommands - Bicep Output', () => {
        it('should generate valid Bicep with correct schedule times', () => {
            const { ScalingCommands } = require('../../commands/scalingCommands');
            const cmds = new ScalingCommands();

            const bicep = (cmds as any).generateBicep(
                {
                    planName: 'scaling-plan-prod',
                    timezone: 'Eastern Standard Time',
                    rampUpTime: '07:00',
                    peakTime: '09:00',
                    rampDownTime: '17:00',
                    offPeakTime: '20:00',
                    peakMinPercent: 100,
                    offPeakMinPercent: 10,
                    includeWeekend: false,
                },
                { hostPoolName: 'hp-prod-eastus', resourceGroup: 'rg-avd' }
            );

            // Validate structural elements
            assert.ok(bicep.includes("param scalingPlanName string = 'scaling-plan-prod'"), 'Should have plan name param');
            assert.ok(bicep.includes("param timeZone string = 'Eastern Standard Time'"), 'Should have timezone');
            assert.ok(bicep.includes('Microsoft.DesktopVirtualization/scalingPlans@'), 'Should have correct resource type');

            // Validate schedule times
            assert.ok(bicep.includes('hour: 7'), 'Ramp-up hour should be 7');
            assert.ok(bicep.includes('hour: 9'), 'Peak hour should be 9');
            assert.ok(bicep.includes('hour: 17'), 'Ramp-down hour should be 17');
            assert.ok(bicep.includes('hour: 20'), 'Off-peak hour should be 20');

            // Validate load balancing algorithms
            assert.ok(bicep.includes('BreadthFirst'), 'Ramp-up should use BreadthFirst');
            assert.ok(bicep.includes('DepthFirst'), 'Peak should use DepthFirst');

            // Validate outputs
            assert.ok(bicep.includes('output scalingPlanId string'), 'Should output plan ID');
            assert.ok(bicep.includes('output scalingPlanName string'), 'Should output plan name');
        });

        it('should generate Bicep without host pool reference when no item provided', () => {
            const { ScalingCommands } = require('../../commands/scalingCommands');
            const cmds = new ScalingCommands();

            const bicep = (cmds as any).generateBicep(
                {
                    planName: 'test-plan',
                    timezone: 'UTC',
                    rampUpTime: '06:00',
                    peakTime: '08:00',
                    rampDownTime: '18:00',
                    offPeakTime: '22:00',
                    peakMinPercent: 80,
                    offPeakMinPercent: 5,
                    includeWeekend: false,
                },
                undefined
            );

            assert.ok(!bicep.includes('Host pool:'), 'Should not have host pool comment when undefined');
            assert.ok(bicep.includes("'test-plan'"), 'Should use provided plan name');
        });

        it('should properly handle midnight times', () => {
            const { ScalingCommands } = require('../../commands/scalingCommands');
            const cmds = new ScalingCommands();

            const bicep = (cmds as any).generateBicep(
                {
                    planName: 'night-plan',
                    timezone: 'UTC',
                    rampUpTime: '00:00',
                    peakTime: '08:00',
                    rampDownTime: '16:00',
                    offPeakTime: '00:00',
                    peakMinPercent: 100,
                    offPeakMinPercent: 0,
                    includeWeekend: false,
                },
                undefined
            );

            assert.ok(bicep.includes('hour: 0'), 'Should handle midnight hour (0)');
        });

        it('should include weekday schedule', () => {
            const { ScalingCommands } = require('../../commands/scalingCommands');
            const cmds = new ScalingCommands();

            const bicep = (cmds as any).generateBicep(
                {
                    planName: 'test',
                    timezone: 'UTC',
                    rampUpTime: '07:00',
                    peakTime: '09:00',
                    rampDownTime: '17:00',
                    offPeakTime: '20:00',
                    peakMinPercent: 100,
                    offPeakMinPercent: 10,
                    includeWeekend: false,
                },
                undefined
            );

            assert.ok(bicep.includes("'Monday'"), 'Should include Monday');
            assert.ok(bicep.includes("'Friday'"), 'Should include Friday');
            assert.ok(!bicep.includes("'Saturday'"), 'Should not include Saturday when weekend disabled');
        });

        it('should include weekend schedule when enabled', () => {
            const { ScalingCommands } = require('../../commands/scalingCommands');
            const cmds = new ScalingCommands();

            const bicep = (cmds as any).generateBicep(
                {
                    planName: 'with-weekend',
                    timezone: 'UTC',
                    rampUpTime: '07:00',
                    peakTime: '09:00',
                    rampDownTime: '17:00',
                    offPeakTime: '20:00',
                    peakMinPercent: 100,
                    offPeakMinPercent: 10,
                    includeWeekend: true,
                },
                undefined
            );

            assert.ok(bicep.includes("'Monday'"), 'Should include weekday');
            assert.ok(bicep.includes("'Saturday'"), 'Should include Saturday when weekend enabled');
            assert.ok(bicep.includes("'Sunday'"), 'Should include Sunday when weekend enabled');
            assert.ok(bicep.includes('weekend_schedule'), 'Should have weekend_schedule block');
        });

        it('should escape single quotes in plan name', () => {
            const { ScalingCommands } = require('../../commands/scalingCommands');
            const cmds = new ScalingCommands();

            const bicep = (cmds as any).generateBicep(
                {
                    planName: "plan's-test",
                    timezone: 'UTC',
                    rampUpTime: '07:00',
                    peakTime: '09:00',
                    rampDownTime: '17:00',
                    offPeakTime: '20:00',
                    peakMinPercent: 100,
                    offPeakMinPercent: 10,
                    includeWeekend: false,
                },
                undefined
            );

            assert.ok(bicep.includes("\\'"), 'Should escape single quotes');
        });
    });
});
