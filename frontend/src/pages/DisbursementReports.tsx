import React, { useState } from 'react';
import { useCrud } from '../hooks/useCrud';

export default function DisbursementReports() {
  const { data: reports, loading, error, fetchAll } = useCrud<any>({ endpoint: '/api/disbursement-reports' });
  const [expanded, setExpanded] = useState({} as Record<number, boolean>);

  React.useEffect(() => { fetchAll(); }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading reports</div>;

  return (
    <div>
      <h2>Disbursement Reports</h2>
      <button onClick={() => fetchAll()}>Refresh</button>
      <ul>
        {reports && reports.map((r: any) => (
          <li key={r.disbursement_report_id} style={{marginBottom: '1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div>
                <strong>{r.disbursement_report_ctrl_number}</strong> — {r.disbursement_date} — {r.status}
              </div>
              <div>
                <button onClick={() => setExpanded(prev => ({...prev, [r.disbursement_report_id]: !prev[r.disbursement_report_id]}))}>
                  {expanded[r.disbursement_report_id] ? 'Hide' : 'Show'} Vouchers
                </button>
              </div>
            </div>
            {expanded[r.disbursement_report_id] && (
              <div style={{paddingLeft: '1rem', marginTop: '0.5rem'}}>
                {r.vouchers && r.vouchers.length > 0 ? (
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr><th>PV Ctrl</th><th>Payee</th><th>Amount</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {r.vouchers.map((v: any) => (
                        <tr key={v.payment_voucher_id}>
                          <td>{v.payment_voucher_control}</td>
                          <td>{v.payee}</td>
                          <td>{v.amount_to_pay}</td>
                          <td>{v.preparation_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div>No vouchers</div>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
