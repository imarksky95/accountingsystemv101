const approvalRouting = require('../backend/approvalRouting');

describe('approvalRouting basic', () => {
  test('exports required functions', () => {
    expect(typeof approvalRouting.routeDocument).toBe('function');
    expect(typeof approvalRouting.applyRoutingToDocument).toBe('function');
    expect(typeof approvalRouting.cascadeApproveDocuments).toBe('function');
  });
});
