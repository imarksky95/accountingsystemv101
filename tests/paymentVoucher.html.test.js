const pvRouter = require('../backend/paymentVoucher');

describe('Payment Voucher HTML generation', () => {
  test('buildPaymentVoucherHtml includes company name and signatories', () => {
    const build = pvRouter.buildPaymentVoucherHtml;
    expect(typeof build).toBe('function');
    const pv = { payment_voucher_control: 'PV-100', preparation_date: '2025-09-23', purpose: 'Test PV', amount_to_pay: 123.45 };
    const payment_lines = [{ payee_display: 'Acme Co', description: 'Service', amount: 123.45 }];
    const journal_lines = [{ coa_id: 1, account_name: 'Cash', debit: 123.45, credit: 0 }, { coa_id: 2, account_name: 'Expenses', debit: 0, credit: 123.45 }];
    const company = { name: 'My Company LLC', address: '123 Street' };
    const html = build(pv, payment_lines, journal_lines, company, 'Alice Prepared', 'Bob Reviewed', 'Carol Approved');
    expect(html).toContain('My Company LLC');
    expect(html).toContain('Alice Prepared');
    expect(html).toContain('Bob Reviewed');
    expect(html).toContain('Carol Approved');
    expect(html).toContain('Cash');
    expect(html).toContain('Expenses');
  });
});
