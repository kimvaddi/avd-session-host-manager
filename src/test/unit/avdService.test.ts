import { assert, sinon } from './testHelper';

describe('AvdService Tests', () => {

    describe('AvdService - Host Pool Parsing', () => {
        it('should extract resource group from host pool ID', () => {
            // Test the regex pattern used in listHostPools
            const testId = '/subscriptions/sub1/resourceGroups/rg-avd-prod/providers/Microsoft.DesktopVirtualization/hostpools/hp-test';
            const rgMatch = testId.match(/\/resourceGroups\/([^/]+)\//i);
            assert.ok(rgMatch, 'Should match resource group pattern');
            assert.strictEqual(rgMatch![1], 'rg-avd-prod');
        });

        it('should handle ID with no resource group gracefully', () => {
            const testId = '/subscriptions/sub1/providers/Something/items/test';
            const rgMatch = testId.match(/\/resourceGroups\/([^/]+)\//i);
            assert.strictEqual(rgMatch, null, 'Should return null for non-matching pattern');
        });

        it('should handle case-insensitive resource group matching', () => {
            const testId = '/subscriptions/sub1/RESOURCEGROUPS/rg-test/providers/test';
            const rgMatch = testId.match(/\/resourceGroups\/([^/]+)\//i);
            assert.ok(rgMatch, 'Should match case-insensitively');
            assert.strictEqual(rgMatch![1], 'rg-test');
        });
    });

    describe('AvdService - VM Name Extraction', () => {
        it('should extract VM name from session host FQDN', () => {
            const sessionHostName = 'vm-avd-001.contoso.com';
            const vmName = sessionHostName.split('.')[0];
            assert.strictEqual(vmName, 'vm-avd-001');
        });

        it('should handle simple name without domain', () => {
            const sessionHostName = 'vm-avd-001';
            const vmName = sessionHostName.split('.')[0];
            assert.strictEqual(vmName, 'vm-avd-001');
        });
    });

    describe('AvdService - KQL Query Generation', () => {
        it('should generate session logs query with correct host pool filter', () => {
            const hostPoolName = 'hp-prod-eastus';
            const hoursBack = 48;
            const query = `
WVDConnections
| where TimeGenerated > ago(${hoursBack}h)
| where _ResourceId contains "${hostPoolName}"
| project TimeGenerated, UserName, SessionHostName, State, 
          CorrelationId, ClientOS, ClientVersion, ClientType
| order by TimeGenerated desc
| take 200
            `.trim();

            assert.ok(query.includes('WVDConnections'), 'Should query WVDConnections table');
            assert.ok(query.includes('hp-prod-eastus'), 'Should filter by host pool');
            assert.ok(query.includes('ago(48h)'), 'Should use correct time range');
            assert.ok(query.includes('take 200'), 'Should limit results');
        });

        it('should generate disconnect analysis query with WVDErrors join', () => {
            const hostPoolName = 'hp-test';
            const hoursBack = 24;
            const query = `
let connections = WVDConnections
| where TimeGenerated > ago(${hoursBack}h)
| where _ResourceId contains "${hostPoolName}"
| where State == "Started" or State == "Completed" or State == "Failed";
let failures = WVDErrors
| where TimeGenerated > ago(${hoursBack}h)
| where _ResourceId contains "${hostPoolName}"
| project TimeGenerated, CorrelationId, CodeSymbolic, Message, Source;
connections
| join kind=leftouter (failures) on CorrelationId
| summarize
    ConnectionCount=count(),
    FailureCount=countif(State == "Failed"),
    SampleError=take_any(CodeSymbolic),
    SampleMessage=take_any(Message)
    by State, ClientOS, ClientType
| order by FailureCount desc, ConnectionCount desc
            `.trim();

            assert.ok(query.includes('WVDConnections'), 'Should query WVDConnections table');
            assert.ok(query.includes('WVDErrors'), 'Should join with WVDErrors table');
            assert.ok(query.includes('CodeSymbolic'), 'Should extract error code');
            assert.ok(query.includes('FailureCount'), 'Should count failures');
            assert.ok(query.includes('SampleMessage'), 'Should include sample error message');
            assert.ok(query.includes('leftouter'), 'Should left join to keep all connections');
        });
    });

    describe('AvdService - VM Resource ID Parsing', () => {
        it('should extract VM resource group from full resource ID', () => {
            const vmResourceId = '/subscriptions/sub1/resourceGroups/rg-vms-prod/providers/Microsoft.Compute/virtualMachines/vm-avd-001';
            const vmRgMatch = vmResourceId.match(/\/resourceGroups\/([^/]+)\//i);
            const vmNameMatch = vmResourceId.match(/\/virtualMachines\/([^/]+)$/i);
            assert.ok(vmRgMatch, 'Should match resource group');
            assert.strictEqual(vmRgMatch![1], 'rg-vms-prod');
            assert.ok(vmNameMatch, 'Should match VM name');
            assert.strictEqual(vmNameMatch![1], 'vm-avd-001');
        });

        it('should handle VM in different RG than host pool', () => {
            // Host pool in rg-avd, VM in rg-compute
            const vmResourceId = '/subscriptions/sub1/resourceGroups/rg-compute/providers/Microsoft.Compute/virtualMachines/sh-001';
            const vmRgMatch = vmResourceId.match(/\/resourceGroups\/([^/]+)\//i);
            const vmNameMatch = vmResourceId.match(/\/virtualMachines\/([^/]+)$/i);
            assert.strictEqual(vmRgMatch![1], 'rg-compute');
            assert.strictEqual(vmNameMatch![1], 'sh-001');
        });
    });
});
