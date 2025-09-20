import React, { useEffect, useState, useContext } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Snackbar, Alert, CircularProgress, IconButton, Table, TableHead, TableRow, TableCell, TableBody, Checkbox } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import { UserContext } from '../UserContext';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://accountingsystemv101.onrender.com';

const emptyForm = {
  status: 'Draft',
  preparation_date: '',
  purpose: '',
  paid_through: '',
  prepared_by: null,
  payee: null,
  description: '',
  amount_to_pay: '',
  coa_id: null,
};

const PaymentVouchers: React.FC = () => {
  const { user } = useContext(UserContext);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Contacts and COA lists
  const [contacts, setContacts] = useState<any[]>([]);
  const [coas, setCoas] = useState<any[]>([]);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Multi-select for DR creation
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [creatingDR, setCreatingDR] = useState(false);

  // Snackbar
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error' | 'info'>('info');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pvRes, contactRes, coaRes] = await Promise.all([
        axios.get(`${API_BASE}/api/payment-vouchers`),
        axios.get(`${API_BASE}/api/contacts`),
        axios.get(`${API_BASE}/api/coa/all/simple`),
      ]);
      setItems(Array.isArray(pvRes.data) ? pvRes.data : []);
      const fetchedContacts = Array.isArray(contactRes.data) ? contactRes.data : [];
      // if no contacts returned, try vendors as fallback
      if (fetchedContacts.length === 0) {
        try {
          const vendRes = await axios.get(`${API_BASE}/api/vendors`);
          const vendors = Array.isArray(vendRes.data) ? vendRes.data : [];
          // Map vendors to contact-like shape
          const mapped = vendors.map(v => ({ contact_id: v.vendor_id, display_name: v.name }));
          setContacts(mapped);
        } catch (e) {
          setContacts([]);
        }
      } else {
        setContacts(fetchedContacts);
      }
      setCoas(Array.isArray(coaRes.data) ? coaRes.data : []);
    } catch (e:any) {
      console.error('fetchAll error', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, preparation_date: new Date().toISOString().slice(0,10), prepared_by: user?.user_id || null }); setOpen(true); };
  const openEdit = (pv: any) => { setEditing(pv); setForm({ ...pv }); setOpen(true); };

  

  const confirmDelete = (id: number) => { setDeleteId(id); setConfirmOpen(true); };
  const doDelete = async () => {
    if (deleteId == null) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/api/payment-vouchers/${deleteId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSnackMsg('Deleted'); setSnackSeverity('success'); setSnackOpen(true);
      setConfirmOpen(false); setDeleteId(null);
      fetchAll();
    } catch (e:any) {
      setSnackMsg(e.response?.data?.error || e.message || 'Delete failed'); setSnackSeverity('error'); setSnackOpen(true);
    }
  };

  const toggleSelect = (id: number) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));

  const createDR = async () => {
    const ids = Object.keys(selected).filter(k => selected[+k]).map(k => +k);
    if (ids.length === 0) { setSnackMsg('Select at least one PV'); setSnackSeverity('info'); setSnackOpen(true); return; }
    const amount_to_pay = items.filter(p => ids.includes(p.payment_voucher_id)).reduce((s, p) => s + (Number(p.amount_to_pay) || 0), 0);
    setCreatingDR(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/api/disbursement-reports`, {
        status: 'Draft',
        disbursement_date: new Date().toISOString().slice(0,10),
        purpose: 'Created from selected PVs',
        amount_to_pay,
        paid_through: 'Bank',
        voucher_ids: ids
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSnackMsg('Disbursement Report created'); setSnackSeverity('success'); setSnackOpen(true);
      setSelected({});
      fetchAll();
    } catch (e:any) {
      setSnackMsg(e.response?.data?.error || e.message || 'Create DR failed'); setSnackSeverity('error'); setSnackOpen(true);
    } finally { setCreatingDR(false); }
  };

  return (
    <Box>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3>Payment Vouchers</h3>
        <div>
          <Button variant="contained" onClick={openNew} sx={{mr:1}}>New PV</Button>
          <Button onClick={() => fetchAll()} sx={{mr:1}}>Refresh</Button>
          <Button color="secondary" variant="outlined" onClick={() => setSelected({})}>Clear Selection</Button>
        </div>
      </div>

      {loading ? <CircularProgress /> : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>PV Ctrl</TableCell>
              <TableCell>Prepared</TableCell>
              <TableCell>Payee</TableCell>
              <TableCell>COA</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map(pv => (
              <TableRow key={pv.payment_voucher_id}>
                <TableCell><Checkbox checked={!!selected[pv.payment_voucher_id]} onChange={() => toggleSelect(pv.payment_voucher_id)} /></TableCell>
                <TableCell>{pv.payment_voucher_control}</TableCell>
                <TableCell>{pv.preparation_date} by {pv.prepared_by_username || pv.prepared_by}</TableCell>
                <TableCell>{pv.payee_name || pv.payee}</TableCell>
                <TableCell>{pv.coa_name || pv.coa_id}</TableCell>
                <TableCell>{pv.amount_to_pay}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => openEdit(pv)}>Edit</Button>
                  <Button size="small" color="error" onClick={() => confirmDelete(pv.payment_voucher_id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={7}>No payment vouchers found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <div style={{marginTop:'1rem'}}>
        <Button variant="contained" color="primary" onClick={createDR} disabled={creatingDR}>{creatingDR ? <><CircularProgress size={16} /> Creating...</> : 'Create DR from selected'}</Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>{editing ? 'Edit Payment Voucher' : 'New Payment Voucher'}<IconButton aria-label="close" onClick={() => setOpen(false)} sx={{position:'absolute', right:8, top:8}}><CloseIcon /></IconButton></DialogTitle>
        <DialogContent>
          {/* Basic Details */}
          <Box sx={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb:2}}>
            <TextField label="Preparation Date" type="date" value={form.preparation_date || ''} onChange={e => setForm({...form, preparation_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <FormControl>
              <InputLabel id="purpose-label">Purpose</InputLabel>
              <Select labelId="purpose-label" value={form.purpose || ''} label="Purpose" onChange={e => setForm({...form, purpose: e.target.value})}>
                <MenuItem value="">-- Select Purpose --</MenuItem>
                <MenuItem value="Bills Payment">Bills Payment</MenuItem>
                <MenuItem value="Liquidation Payouts">Liquidation Payouts</MenuItem>
                <MenuItem value="Government and Other Agency Payments">Government and Other Agency Payments</MenuItem>
                <MenuItem value="OSM Request">OSM Request</MenuItem>
                <MenuItem value="Cash Advance / Budget Request">Cash Advance / Budget Request</MenuItem>
                <MenuItem value="Other Payments">Other Payments</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Payment Details - dynamic rows */}
          <Box sx={{mt:2, mb:2}}>
            <Box sx={{fontWeight:700, mb:1}}>PAYMENT DETAILS</Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Payee</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount to Pay</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(form.payment_lines || []).map((line:any, idx:number) => (
                  <TableRow key={idx}>
                    <TableCell sx={{minWidth:200}}>
                      <Select fullWidth value={line.payee_id || line.payee || ''} onChange={e => {
                        const v = e.target.value; const copy = {...form}; copy.payment_lines[idx].payee_id = v; copy.payment_lines[idx].payee_name = contacts.find(c=>String(c.contact_id)===String(v))?.display_name || '' ;
                        // set top-level payee to selected contact so listing shows friendly name
                        copy.payee = v ? String(v) : copy.payee;
                        setForm(copy);
                      }}>
                        <MenuItem value="">-- Select Payee --</MenuItem>
                        {contacts.map(c => (
                          <MenuItem key={c.contact_id} value={String(c.contact_id)}>
                            {c.display_name}
                            {c.contact_type ? ` (${c.contact_type})` : ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField fullWidth value={line.description || ''} onChange={e => { const copy = {...form}; copy.payment_lines[idx].description = e.target.value; setForm(copy); }} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField type="number" value={line.amount || ''} onChange={e => { const copy = {...form}; copy.payment_lines[idx].amount = e.target.value; setForm(copy); }} InputProps={{ sx: { textAlign: 'right' } }} />
                    </TableCell>
                    <TableCell>
                      <Button color="error" onClick={() => { const copy = {...form}; copy.payment_lines = copy.payment_lines.filter((_:any,i:number)=>i!==idx); setForm(copy); }}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{mt:1}}>
              <Button onClick={() => {
                const copy = {...form};
                copy.payment_lines = copy.payment_lines || [];
                copy.payment_lines.push({payee_id:'', description:'', amount:0});
                // if no top-level payee yet, set it to this line's payee (empty until user selects)
                if (!copy.payee && copy.payment_lines.length === 1) copy.payee = '';
                setForm(copy);
              }}>+ Add another line</Button>
            </Box>
            <Box sx={{mt:2, textAlign:'right', fontWeight:700}}>Total Amount to Pay: PHP {(form.payment_lines || []).reduce((s:any,l:any)=>s + (Number(l.amount)||0), 0)}</Box>
          </Box>

          {/* Journal Entry - dynamic rows */}
          <Box sx={{mt:2, mb:2}}>
            <Box sx={{fontWeight:700, mb:1}}>JOURNAL ENTRY</Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>COA</TableCell>
                  <TableCell>Debit</TableCell>
                  <TableCell>Credit</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(form.journal_lines || []).map((line:any, idx:number) => (
                  <TableRow key={idx}>
                    <TableCell sx={{minWidth:200}}>
                      <Select fullWidth value={line.coa_id || ''} onChange={e => { const copy = {...form}; copy.journal_lines[idx].coa_id = e.target.value; setForm(copy); }}>
                        <MenuItem value="">-- Select COA --</MenuItem>
                        {coas.map((a:any) => <MenuItem key={a.coa_id} value={a.coa_id}>{a.account_name || a.name || a.coa_id}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField fullWidth value={line.debit || ''} onChange={e => { const copy = {...form}; copy.journal_lines[idx].debit = e.target.value; setForm(copy); }} InputProps={{ sx: { textAlign: 'right' } }} />
                    </TableCell>
                    <TableCell>
                      <TextField fullWidth value={line.credit || ''} onChange={e => { const copy = {...form}; copy.journal_lines[idx].credit = e.target.value; setForm(copy); }} InputProps={{ sx: { textAlign: 'right' } }} />
                    </TableCell>
                    <TableCell>
                      <TextField fullWidth value={line.remarks || ''} onChange={e => { const copy = {...form}; copy.journal_lines[idx].remarks = e.target.value; setForm(copy); }} />
                    </TableCell>
                    <TableCell>
                      <Button color="error" onClick={() => { const copy = {...form}; copy.journal_lines = copy.journal_lines.filter((_:any,i:number)=>i!==idx); setForm(copy); }}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{mt:1}}>
              <Button onClick={() => { const copy = {...form}; copy.journal_lines = copy.journal_lines || []; copy.journal_lines.push({coa_id:'', debit:0, credit:0, remarks:''}); setForm(copy); }}>+ Add another line</Button>
            </Box>
            <Box sx={{mt:2, textAlign:'right'}}>
              <div><strong>Total Debit</strong> PHP {(form.journal_lines || []).reduce((s:any,l:any)=>s + (Number(l.debit)||0), 0)}</div>
              <div><strong>Total Credit</strong> PHP {(form.journal_lines || []).reduce((s:any,l:any)=>s + (Number(l.credit)||0), 0)}</div>
            </Box>
          </Box>

          {/* Signatories */}
          <Box sx={{mt:2, mb:2}}>
            <Box sx={{fontWeight:700, mb:1}}>SIGNATORIES</Box>
            <Box sx={{display:'grid', gridTemplateColumns: '1fr 1fr 1fr', gap:2}}>
              <TextField label="Prepared By" value={user?.username || ''} disabled />
              <TextField label="Reviewed By" value={form.reviewed_by || ''} onChange={e => setForm({...form, reviewed_by: e.target.value})} />
              <TextField label="Approved By" value={form.approved_by || ''} onChange={e => setForm({...form, approved_by: e.target.value})} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            // Validation rules
            if (!form.purpose) { setSnackMsg('Purpose is required'); setSnackSeverity('error'); setSnackOpen(true); return; }
            if (!form.payment_lines || form.payment_lines.length === 0) { setSnackMsg('At least one payment line is required'); setSnackSeverity('error'); setSnackOpen(true); return; }
            if (!form.journal_lines || form.journal_lines.length < 2) { setSnackMsg('At least two journal entry lines are required'); setSnackSeverity('error'); setSnackOpen(true); return; }
            if (!form.reviewed_by || !form.approved_by) { setSnackMsg('Reviewed by and Approved by must be filled'); setSnackSeverity('error'); setSnackOpen(true); return; }
            // Totals check optional: ensure debit == credit
            const totalDebit = (form.journal_lines || []).reduce((s:any,l:any)=>s + (Number(l.debit)||0), 0);
            const totalCredit = (form.journal_lines || []).reduce((s:any,l:any)=>s + (Number(l.credit)||0), 0);
            if (totalDebit !== totalCredit) { setSnackMsg('Total Debit and Total Credit must be equal'); setSnackSeverity('error'); setSnackOpen(true); return; }
            // Prepare payload mapping lines to expected backend fields (flatten payment_lines into a simplified array)
            // Map payment lines to backend field names: payee_contact_id and payee_display
            const mappedPaymentLines = (form.payment_lines || []).map((l:any) => {
              const contactId = l.payee_id || l.payee_contact_id || '';
              const display = l.payee_name || l.payee_display || (contacts.find((c:any) => String(c.contact_id) === String(contactId))?.display_name) || '';
              return { payee_contact_id: contactId ? Number(contactId) : null, payee_display: display, description: l.description, amount: Number(l.amount) };
            });

            // Set top-level payee so backend can JOIN and produce payee_name in list view. Use first payment line if present.
            const topPayee = mappedPaymentLines.length > 0 && mappedPaymentLines[0].payee_contact_id ? String(mappedPaymentLines[0].payee_contact_id) : (form.payee || '');

            const payload = {
              status: form.status || 'Draft',
              preparation_date: form.preparation_date,
              purpose: form.purpose,
              paid_through: form.paid_through || 'Bank',
              prepared_by: user?.user_id || null,
              payee: topPayee,
              amount_to_pay: (form.payment_lines || []).reduce((s:any,l:any)=>s + (Number(l.amount)||0), 0),
              description: form.description || '',
              payment_lines: mappedPaymentLines,
              journal_lines: (form.journal_lines || []).map((l:any) => ({ coa_id: l.coa_id || null, debit: Number(l.debit)||0, credit: Number(l.credit)||0, remarks: l.remarks || '' })),
              reviewed_by: form.reviewed_by,
              approved_by: form.approved_by
            };
            try {
              const token = localStorage.getItem('token');
              if (editing) await axios.put(`${API_BASE}/api/payment-vouchers/${editing.payment_voucher_id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
              else await axios.post(`${API_BASE}/api/payment-vouchers`, payload, { headers: { Authorization: `Bearer ${token}` } });
              setSnackMsg(editing ? 'Payment Voucher updated' : 'Payment Voucher created'); setSnackSeverity('success'); setSnackOpen(true); setOpen(false); fetchAll();
            } catch (err:any) { setSnackMsg(err.response?.data?.error || err.message || 'Save failed'); setSnackSeverity('error'); setSnackOpen(true); }
          }} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>Are you sure you want to delete this payment voucher?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button color="error" onClick={doDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackOpen} autoHideDuration={4000} onClose={() => setSnackOpen(false)}>
        <Alert severity={snackSeverity} sx={{ width: '100%' }}>{snackMsg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default PaymentVouchers;
