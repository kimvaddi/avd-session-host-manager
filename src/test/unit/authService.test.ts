import { assert, sinon } from './testHelper';

describe('AuthService Tests', () => {

    describe('AuthService - State Management', () => {
        it('should start as not signed in', () => {
            const { AuthService } = require('../../services/authService');
            const mockContext = {
                globalState: {
                    get: sinon.stub().returns(undefined),
                    update: sinon.stub().resolves(),
                },
            };
            const auth = new AuthService(mockContext as any);
            assert.strictEqual(auth.isSignedIn(), false);
        });

        it('should throw when getting credential while not signed in', () => {
            const { AuthService } = require('../../services/authService');
            const mockContext = {
                globalState: {
                    get: sinon.stub().returns(undefined),
                    update: sinon.stub().resolves(),
                },
            };
            const auth = new AuthService(mockContext as any);
            assert.throws(() => auth.getCredential(), /Not signed in/);
        });

        it('should throw when getting subscriptionId without selection', () => {
            const { AuthService } = require('../../services/authService');
            const mockContext = {
                globalState: {
                    get: sinon.stub().returns(undefined),
                    update: sinon.stub().resolves(),
                },
            };
            const auth = new AuthService(mockContext as any);
            assert.throws(() => auth.getSubscriptionId(), /No subscription selected/);
        });

        it('should restore subscription from globalState', () => {
            const { AuthService } = require('../../services/authService');
            const mockContext = {
                globalState: {
                    get: sinon.stub().callsFake((key: string) => {
                        if (key === 'avd.subscriptionId') { return 'sub-123'; }
                        if (key === 'avd.subscriptionName') { return 'My Sub'; }
                        return undefined;
                    }),
                    update: sinon.stub().resolves(),
                },
            };
            const auth = new AuthService(mockContext as any);
            assert.strictEqual(auth.getSubscriptionName(), 'My Sub');
        });

        it('should clear state on signOut', () => {
            const { AuthService } = require('../../services/authService');
            const updateStub = sinon.stub().resolves();
            const mockContext = {
                globalState: {
                    get: sinon.stub().returns(undefined),
                    update: updateStub,
                },
            };
            const auth = new AuthService(mockContext as any);

            auth.signOut();

            assert.strictEqual(auth.isSignedIn(), false);
            assert.ok(updateStub.calledWith('avd.subscriptionId', undefined));
            assert.ok(updateStub.calledWith('avd.subscriptionName', undefined));
        });

        it('should return account name as undefined when not signed in', () => {
            const { AuthService } = require('../../services/authService');
            const mockContext = {
                globalState: {
                    get: sinon.stub().returns(undefined),
                    update: sinon.stub().resolves(),
                },
            };
            const auth = new AuthService(mockContext as any);
            assert.strictEqual(auth.getAccountName(), undefined);
        });
    });
});
