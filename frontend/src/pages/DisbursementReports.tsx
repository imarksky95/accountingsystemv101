import React, { useState, useEffect } from 'react';
import { useCrud } from '../hooks/useCrud';
import axios from 'axios';
import { Snackbar, Alert, CircularProgress } from '@mui/material';
import { buildUrl, API_BASE as RESOLVED_API_BASE } from '../apiBase';
import { formatDateToMMDDYYYY } from '../utils/date';
console.debug && console.debug('DisbursementReports: resolved API_BASE =', RESOLVED_API_BASE || '(empty, using fallback)');

export default function DisbursementReports() {
  const { data: reports, loading, error, fetchAll } = useCrud<any>({ endpoint: '/api/disbursement-reports' });
  const [expanded, setExpanded] = useState({} as Record<number, boolean>);
  const [pvList, setPvList] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
  // fetch available payment vouchers
  axios.get(buildUrl('/api/payment-vouchers')).then(r => setPvList(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  // Snackbar state
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success'|'error'|'info'>('info');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading reports</div>;

  return (
    <div>
      <h2>Disbursement Reports</h2>
      <button onClick={() => fetchAll()}>Refresh</button>
      <div style={{display:'flex',gap: '2rem'}}>
        <div style={{flex:1}}>
          <h3>Available Payment Vouchers</h3>
          <div>
            <button onClick={() => setSelected({})}>Clear</button>
            <button onClick={() => axios.get(buildUrl('/api/payment-vouchers')).then(r => setPvList(r.data)).catch(() => {})}>Refresh</button>
          </div>
          <ul>
            {pvList.map(pv => (
              <li key={pv.payment_voucher_id} style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <input type="checkbox" checked={!!selected[pv.payment_voucher_id]} onChange={() => setSelected(prev=>({...prev,[pv.payment_voucher_id]: !prev[pv.payment_voucher_id]}))} />
                <div>{pv.payment_voucher_control} — {pv.payee_name || (pv.payment_lines && pv.payment_lines[0] && (pv.payment_lines[0].payee_display || pv.payment_lines[0].payee_contact_id)) || ''} — {pv.amount_to_pay || (pv.payment_lines && pv.payment_lines.length ? pv.payment_lines.reduce((s:any,l:any)=>s + (Number(l.amount)||0),0) : 0)}</div>
              </li>
            ))}
          </ul>
          <div>
            <button disabled={creating} onClick={async () => {
              const ids = Object.keys(selected).filter(k=>selected[+k]).map(k=>+k);
              if (ids.length === 0) {
                setSnackMsg('Select at least one PV');
                setSnackSeverity('info');
                setSnackOpen(true);
                return;
              }
              const amount_to_pay = pvList.filter(p => ids.includes(p.payment_voucher_id)).reduce((s, p) => s + (Number(p.amount_to_pay) || (p.payment_lines && p.payment_lines.length ? p.payment_lines.reduce((ss:any,l:any)=>ss + (Number(l.amount)||0),0) : 0)), 0);
              setCreating(true);
              try {
                const token = localStorage.getItem('token');
                await axios.post(buildUrl('/api/disbursement-reports'), {
                  status: 'Draft',
                  disbursement_date: new Date().toISOString().slice(0,10),
                  purpose: 'Bulk created from UI',
                  amount_to_pay,
                  paid_through: 'Bank',
                  voucher_ids: ids
                }, { headers: { Authorization: `Bearer ${token}` } });
                setSnackMsg('Disbursement Report created');
                setSnackSeverity('success');
                setSnackOpen(true);
                fetchAll();
                setSelected({});
              } catch (e:any) {
                setSnackMsg(e.response?.data?.error || e.message || 'Create failed');
                setSnackSeverity('error');
                setSnackOpen(true);
              } finally { setCreating(false); }
            }}>{creating ? <><CircularProgress size={16} /> Creating...</> : 'Create DR from selected'}</button>
          </div>
        </div>
        <div style={{flex:2}}>
          <h2>Disbursement Reports</h2>
          <button onClick={() => fetchAll()}>Refresh</button>
          <ul>
            {reports && reports.map((r: any) => (
          <li key={r.disbursement_report_id} style={{marginBottom: '1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div>
                <strong>{r.disbursement_report_ctrl_number}</strong> — {formatDateToMMDDYYYY(r.disbursement_date)} — {r.status}
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
                          <td>{v.payee_name || (v.payment_lines && v.payment_lines[0] && (v.payment_lines[0].payee_display || v.payment_lines[0].payee_contact_id)) || ''}</td>
                          <td>{v.amount_to_pay || (v.payment_lines && v.payment_lines.length ? v.payment_lines.reduce((ss:any,l:any)=>ss + (Number(l.amount)||0),0) : 0)}</td>
                          <td>{formatDateToMMDDYYYY(v.preparation_date)}</td>
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
      </div>
      <Snackbar open={snackOpen} autoHideDuration={4000} onClose={() => setSnackOpen(false)}>
        <Alert severity={snackSeverity} sx={{ width: '100%' }}>{snackMsg}</Alert>
      </Snackbar>
    </div>
  );
}
