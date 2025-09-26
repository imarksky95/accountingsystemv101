import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, Snackbar, Alert, IconButton, Table, TableHead, TableRow, TableCell, TableBody, Grid, Paper, Divider, Typography, Autocomplete } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import { tryFetchWithFallback, buildUrl } from '../apiBase';

type PaymentLine = { payee_contact_id?: number | null; payee_display?: string; description?: string; amount?: number | string };
type JournalLine = { coa_id?: number | string | null; debit?: number | string; credit?: number | string; remarks?: string };

const emptyPaymentLine = (): PaymentLine => ({ payee_contact_id: null, payee_display: '', description: '', amount: 0 });
const emptyJournalLine = (): JournalLine => ({ coa_id: '', debit: 0, credit: 0, remarks: '' });

const CheckVouchers: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  // loading is intentionally not used in the modal flow; keep local if needed in future
  const [contacts, setContacts] = useState<any[]>([]);
  const [coas, setCoas] = useState<any[]>([]);

  // Dialog/form state modeled after PaymentVouchers modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const firstFocusRef = useRef<HTMLInputElement | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success'|'error'|'info'>('info');
  const [userNames, setUserNames] = useState<Record<string,string>>({});
  const [userOptions, setUserOptions] = useState<Array<{user_id:number, full_name?:string, username?:string}>>([]);

  const fetchList = async () => {
    try {
      const r = await tryFetchWithFallback('/api/check-vouchers');
      if (r.ok) setItems(await r.json());
      else setItems([]);
    } catch (_) { setItems([]); }
  };

  useEffect(() => { fetchList(); }, []);

  const fetchContacts = async () => {
    try {
      const r = await axios.get(buildUrl('/api/contacts'));
      setContacts(Array.isArray(r.data) ? r.data : []);
      return r.data;
    } catch (e) { setContacts([]); return [] }
  };
  const fetchCoas = async () => {
    try { const r = await axios.get(buildUrl('/api/coa/all/simple')); setCoas(Array.isArray(r.data)?r.data:[]); return r.data; } catch (e) { setCoas([]); return []; }
  };

  const fetchUserOptions = async () => {
    try {
      const r = await axios.get(buildUrl('/api/users/public'));
      setUserOptions(Array.isArray(r.data) ? r.data : []);
      // seed userNames cache
      const map: Record<string,string> = {};
      for (const u of (r.data||[])) { if (u && u.user_id) map[String(u.user_id)] = u.full_name || u.username || String(u.user_id); }
      setUserNames(prev => ({ ...map, ...prev }));
      return r.data;
    } catch (e) { return []; }
  };

  const openNew = async () => {
    await Promise.all([fetchContacts(), fetchCoas(), fetchUserOptions()]);
    setEditing(null);
    // seed current user into userNames cache when available
    let currentUserId: number | null = null;
    try {
      const token = localStorage.getItem('token');
      const meResp = await axios.get(buildUrl('/api/auth/me'), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (meResp && meResp.data && meResp.data.user_id) {
        currentUserId = meResp.data.user_id;
        setUserNames(prev => ({ ...prev, [String(meResp.data.user_id)]: meResp.data.full_name || meResp.data.username || String(meResp.data.user_id) }));
      }
    } catch (e) {}
    setForm({
      cvoucher_date: new Date().toISOString().slice(0,10),
      purpose: '',
      payment_lines: [ emptyPaymentLine() ],
      journal_lines: [ emptyJournalLine(), emptyJournalLine() ], // require at least two
      // check lines for multi-check mode
      mode: 'single',
      check_lines: [],
      prepared_by: currentUserId,
      reviewed_by: null,
      approved_by: null,
      paid_through: 'Bank',
      status: 'Draft'
    });
    setOpen(true);
    setTimeout(()=>{ try { firstFocusRef.current?.focus(); } catch(e){} }, 0);
  };

  const openEdit = async (cv:any) => {
    await Promise.all([fetchContacts(), fetchCoas(), fetchUserOptions()]);
    setEditing(cv);
    setForm({
      ...cv,
      cvoucher_date: cv.cvoucher_date && typeof cv.cvoucher_date === 'string' && cv.cvoucher_date.indexOf('T') !== -1 ? cv.cvoucher_date.slice(0,10) : cv.cvoucher_date,
      payment_lines: (cv.payment_lines && cv.payment_lines.length) ? cv.payment_lines.map((pl:any)=>({ payee_contact_id: pl.payee_contact_id, payee_display: pl.payee_display, description: pl.description, amount: pl.amount })) : [ emptyPaymentLine() ],
      journal_lines: (cv.journal_lines && cv.journal_lines.length) ? cv.journal_lines.map((jl:any)=>({ coa_id: jl.coa_id, debit: jl.debit, credit: jl.credit, remarks: jl.remarks })) : [ emptyJournalLine(), emptyJournalLine() ],
      mode: cv.multiple_checks ? 'multi' : 'single',
      check_lines: cv.check_lines && cv.check_lines.length ? cv.check_lines.map((cl:any)=>({ check_date: cl.check_date, check_number: cl.check_number, check_amount: cl.check_amount, check_subpayee: cl.check_subpayee })) : []
    });
    setOpen(true);
    // seed signatory names cache for prepared/reviewed/approved if numeric IDs
    try {
      const token = localStorage.getItem('token');
      const toResolve: string[] = [];
      const maybe = (v:any) => (v !== undefined && v !== null) ? v : '';
      const vals = [maybe(cv.prepared_by), maybe(cv.prepared_by_manual), maybe(cv.reviewed_by), maybe(cv.reviewed_by_manual), maybe(cv.approved_by), maybe(cv.approved_by_manual)];
      for (const v of vals) {
        if (v && !isNaN(Number(v))) toResolve.push(String(v));
      }
      for (const id of Array.from(new Set(toResolve))) {
        if (!userNames[id]) {
          try { const r = await axios.get(buildUrl(`/api/users/${id}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} }); if (r && r.data) setUserNames(prev => ({ ...prev, [id]: r.data.full_name || r.data.username || id })); } catch (e) { }
        }
      }
    } catch (e) {}
  };

  const parseSignatoryValue = (val:any): string[] => {
    if (val === undefined || val === null || val === '') return [];
    if (Array.isArray(val)) return val.map(String).filter(Boolean);
    if (typeof val === 'number') return [String(val)];
    if (typeof val === 'string') {
      try {
        const p = JSON.parse(val);
        if (Array.isArray(p)) return p.map(String).filter(Boolean);
        if (typeof p === 'number' || typeof p === 'string') return [String(p)];
      } catch (e) {}
      const m = val.match(/\d+/);
      if (m) return [m[0]];
      return [];
    }
    return [];
  };

  const getSignatoryDisplay = (val:any): string => {
    const ids = parseSignatoryValue(val);
    if (ids.length) return ids.map(id => userNames[String(id)] || String(id)).join(', ');
    if (val && typeof val === 'string') return val;
    return '';
  };

  const resetForm = () => { setForm({}); setEditing(null); setOpen(false); };

  const save = async () => {
    // Validation similar to PaymentVouchers
    if (!form.purpose) { setSnackMsg('Purpose is required'); setSnackSeverity('error'); setSnackOpen(true); return; }
    if (!form.payment_lines || form.payment_lines.length === 0) { setSnackMsg('At least one payment line is required'); setSnackSeverity('error'); setSnackOpen(true); return; }
    if (!form.journal_lines || form.journal_lines.length < 2) { setSnackMsg('At least two journal entry lines are required'); setSnackSeverity('error'); setSnackOpen(true); return; }
  // totalPay computed implicitly via totals below when needed
    const totalDebit = (form.journal_lines || []).reduce((s:any,l:any)=>s + (Number(l.debit)||0), 0);
    const totalCredit = (form.journal_lines || []).reduce((s:any,l:any)=>s + (Number(l.credit)||0), 0);
    if (totalDebit !== totalCredit) { setSnackMsg('Total Debit and Total Credit must be equal'); setSnackSeverity('error'); setSnackOpen(true); return; }

    // Map payment lines
    const mappedPaymentLines = (form.payment_lines || []).map((l:any) => ({ payee_contact_id: l.payee_contact_id ? Number(l.payee_contact_id) : null, payee_display: l.payee_display || (contacts.find((c:any)=>String(c.contact_id)===String(l.payee_contact_id))?.display_name) || '', description: l.description || '', amount: Number(l.amount)||0 }));
    const mappedJournalLines = (form.journal_lines || []).map((l:any)=>({ coa_id: l.coa_id || null, debit: Number(l.debit)||0, credit: Number(l.credit)||0, remarks: l.remarks || '' }));

    const payload: any = {
      status: form.status || 'Draft',
      cvoucher_date: form.cvoucher_date,
      purpose: form.purpose,
      paid_through: form.paid_through || 'Bank',
      prepared_by: form.prepared_by || null,
      description: form.description || '',
      payment_lines: mappedPaymentLines,
      journal_lines: mappedJournalLines
    };
    // map reviewers/approvers: numeric -> reviewer_id/approver_id, free text -> reviewer_manual/approver_manual
    const parseReviewer = (v:any) => {
      if (v === null || v === undefined || v === '') return { id: null, manual: null };
      if (!isNaN(Number(v))) return { id: Number(v), manual: null };
      return { id: null, manual: String(v) };
    };
    const rv = parseReviewer(form.reviewed_by);
    const av = parseReviewer(form.approved_by);
    if (rv.id) payload.reviewer_id = rv.id; else if (rv.manual) payload.reviewer_manual = rv.manual;
    if (av.id) payload.approver_id = av.id; else if (av.manual) payload.approver_manual = av.manual;
    // keep legacy fields as well
    payload.reviewed_by = form.reviewed_by || null;
    payload.approved_by = form.approved_by || null;
    // include check_lines if multi; for single mode include check_no and check_amount
    if (form.mode === 'multi' && Array.isArray(form.check_lines)) {
      payload.check_lines = (form.check_lines || []).map((c:any)=>({ check_number: c.check_number || c.check_no || null, check_date: c.check_date || null, check_amount: Number(c.check_amount)||0, check_subpayee: c.check_subpayee || null }));
      payload.multiple_checks = 1;
    } else {
      payload.multiple_checks = 0;
      // include single-check fields
      if (form.check_no) payload.check_no = form.check_no;
      // include top-level check_amount if present (otherwise backend computes from payment_lines)
      if (form.check_amount || form.check_amount === 0) payload.check_amount = Number(form.check_amount);
    }

    try {
      const token = localStorage.getItem('token');
      if (editing && editing.check_voucher_id) {
        await axios.put(buildUrl(`/api/check-vouchers/${editing.check_voucher_id}`), payload, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setSnackMsg('Check Voucher updated'); setSnackSeverity('success'); setSnackOpen(true); setOpen(false); fetchList();
      } else {
        const res = await axios.post(buildUrl('/api/check-vouchers'), payload, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const ctrl = res.data && res.data.check_voucher && res.data.check_voucher.check_voucher_control ? res.data.check_voucher.check_voucher_control : null;
        setSnackMsg(ctrl ? `Check Voucher created (${ctrl})` : 'Check Voucher created'); setSnackSeverity('success'); setSnackOpen(true); setOpen(false); fetchList();
      }
    } catch (err:any) {
      setSnackMsg(err.response?.data?.error || err.message || 'Save failed'); setSnackSeverity('error'); setSnackOpen(true);
    }
  };

  // Preview / Print
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const downloadPdf = async (cvId: number | string | undefined) => {
    if (!cvId) return;
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string,string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await tryFetchWithFallback(`/api/check-vouchers/${cvId}/pdf`, { headers });
      if (!resp.ok) {
        const txt = await resp.text();
        let msg = txt;
        try { msg = JSON.parse(txt).error || txt; } catch (e) { msg = txt; }
        setSnackMsg(msg || `PDF request failed: ${resp.status}`); setSnackSeverity('error'); setSnackOpen(true); return;
      }
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/pdf')) {
        const txt = await resp.text();
        let msg = txt;
        try { msg = JSON.parse(txt).error || txt; } catch (e) { msg = txt; }
        setSnackMsg(msg || 'Server did not return a PDF'); setSnackSeverity('error'); setSnackOpen(true); return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const disp = resp.headers.get('content-disposition') || '';
      let filename = 'check-voucher.pdf';
      const m = /filename="?([^";]+)"?/.exec(disp);
      if (m && m[1]) filename = m[1];
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e:any) { setSnackMsg(e?.message || 'Download failed'); setSnackSeverity('error'); setSnackOpen(true); }
  };

  return (
    <Box>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3>Check Vouchers</h3>
        <div>
          <Button variant="contained" onClick={openNew} sx={{mr:1}}>New CV</Button>
          <Button onClick={() => fetchList()} sx={{mr:1}}>Refresh</Button>
        </div>
      </div>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Existing Check Vouchers</Typography>
            <Divider sx={{ my: 1 }} />
            <Box>
              <ul>
                {items.map(cv => (
                  <li key={cv.check_voucher_id} style={{marginBottom:6}}>
                    <strong>{cv.check_voucher_control}</strong> — {cv.check_payee || (cv.payment_lines && cv.payment_lines[0] && (cv.payment_lines[0].payee_display || cv.payment_lines[0].payee_name)) || ''} — PHP {cv.check_amount || (cv.payment_lines && cv.payment_lines.length ? cv.payment_lines.reduce((s:any,l:any)=>s + (Number(l.amount)||0),0) : 0)}
                    <div style={{marginTop:4}}>
                      <Button size="small" onClick={() => openEdit(cv)} sx={{mr:1}}>Edit</Button>
                      <Button size="small" onClick={async () => {
                        // Try fetch full server item then open preview
                        try {
                          const token = localStorage.getItem('token');
                          const r = await axios.get(buildUrl(`/api/check-vouchers/${cv.check_voucher_id}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                          setPreviewItem(r && r.data ? r.data : cv);
                        } catch (e) { setPreviewItem(cv); }
                        setPreviewOpen(true);
                      }}>Preview</Button>
                    </div>
                  </li>
                ))}
                {items.length === 0 && <li>No check vouchers found.</li>}
              </ul>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>{editing ? `Edit Check Voucher (${(editing && editing.check_voucher_control) || ''})` : `New Check Voucher`}<IconButton aria-label="close" onClick={() => setOpen(false)} sx={{position:'absolute', right:8, top:8}}><CloseIcon /></IconButton></DialogTitle>
        <DialogContent>
          <Box sx={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb:2}}>
            <TextField inputRef={firstFocusRef} label="Check Date" type="date" value={form.cvoucher_date || ''} onChange={e => setForm({...form, cvoucher_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <TextField label="Purpose" value={form.purpose || ''} onChange={e => setForm({...form, purpose: e.target.value})} />
          </Box>

          {/* Single check number field (only when mode is single) */}
          {form.mode !== 'multi' && (
            <Box sx={{mb:2}}>
              <TextField label="Check Number" value={form.check_no || ''} onChange={e => setForm({...form, check_no: e.target.value})} />
            </Box>
          )}

          {/* Mode: single or multi checks */}
          <Box sx={{my:1}}>
            <Box>
              <label style={{marginRight:12}}><input type="radio" name="mode" checked={form.mode !== 'multi'} onChange={()=>setForm({...form, mode: 'single'})} /> Single Check Voucher</label>
              <label><input type="radio" name="mode" checked={form.mode === 'multi'} onChange={()=>setForm({...form, mode: 'multi'})} /> Multi-Check Voucher</label>
            </Box>
          </Box>

          {/* Check lines for multi */}
          {form.mode === 'multi' && (
            <Box sx={{mt:2, mb:2}}>
              <Typography variant="subtitle1">Check Lines</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Check Date</TableCell>
                    <TableCell>Check No</TableCell>
                    <TableCell>Payee</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(form.check_lines || []).map((cl:any, idx:number) => (
                    <TableRow key={idx}>
                      <TableCell><TextField type="date" value={cl.check_date || ''} onChange={e => { const copy = {...form}; copy.check_lines = copy.check_lines || []; copy.check_lines[idx] = { ...(copy.check_lines[idx]||{}), check_date: e.target.value }; setForm(copy); }} InputLabelProps={{ shrink: true }} /></TableCell>
                      <TableCell><TextField value={cl.check_number || ''} onChange={e => { const copy = {...form}; copy.check_lines = copy.check_lines || []; copy.check_lines[idx] = { ...(copy.check_lines[idx]||{}), check_number: e.target.value }; setForm(copy); }} /></TableCell>
                      <TableCell>
                        <Select fullWidth value={String(cl.check_subpayee || '')} onChange={e => { const copy = {...form}; copy.check_lines = copy.check_lines || []; copy.check_lines[idx] = { ...(copy.check_lines[idx]||{}), check_subpayee: e.target.value ? Number(e.target.value) : null }; setForm(copy); }}>
                          <MenuItem value="">(Select contact)</MenuItem>
                          {contacts.map((c:any)=> <MenuItem key={c.contact_id} value={c.contact_id}>{c.display_name}</MenuItem>)}
                        </Select>
                      </TableCell>
                      <TableCell align="right"><TextField type="number" value={cl.check_amount || ''} onChange={e => { const copy = {...form}; copy.check_lines = copy.check_lines || []; copy.check_lines[idx] = { ...(copy.check_lines[idx]||{}), check_amount: e.target.value === '' ? '' : Number(e.target.value) }; setForm(copy); }} InputProps={{ sx: { textAlign: 'right' } }} /></TableCell>
                      <TableCell><Button color="error" onClick={() => { const copy = {...form}; copy.check_lines = copy.check_lines || []; copy.check_lines = copy.check_lines.filter((_:any,i:number)=>i!==idx); setForm(copy); }}>Remove</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box sx={{mt:1}}><Button onClick={() => { const copy = {...form}; copy.check_lines = copy.check_lines || []; copy.check_lines.push({ check_date:'', check_number:'', check_amount:0, check_subpayee: null }); setForm(copy); }}>Add Check Line</Button></Box>
            </Box>
          )}

          {/* Payment Details */}
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
                      <Select fullWidth value={String(line.payee_contact_id || '')} onChange={e => { const v = e.target.value; const copy = {...form}; copy.payment_lines = copy.payment_lines || []; copy.payment_lines[idx] = { ...(copy.payment_lines[idx] || {}), payee_contact_id: v ? Number(v) : null, payee_display: contacts.find((c:any)=>String(c.contact_id)===String(v))?.display_name || '' }; setForm(copy); }}>
                        <MenuItem value="">-- Select Payee --</MenuItem>
                        {contacts.map((c:any) => <MenuItem key={c.contact_id} value={String(c.contact_id)}>{c.display_name}{c.contact_type ? ` (${c.contact_type})` : ''}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField fullWidth value={line.description || ''} onChange={e => { const copy = {...form}; copy.payment_lines = copy.payment_lines || []; copy.payment_lines[idx] = { ...(copy.payment_lines[idx] || {}), description: e.target.value }; setForm(copy); }} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField type="number" value={line.amount || ''} onChange={e => { const copy = {...form}; copy.payment_lines = copy.payment_lines || []; copy.payment_lines[idx] = { ...(copy.payment_lines[idx] || {}), amount: e.target.value }; setForm(copy); }} InputProps={{ sx: { textAlign: 'right' } }} />
                    </TableCell>
                    <TableCell>
                      <Button color="error" onClick={() => { const copy = {...form}; copy.payment_lines = copy.payment_lines || []; copy.payment_lines = copy.payment_lines.filter((_:any,i:number)=>i!==idx); setForm(copy); }}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{mt:1}}>
              <Button onClick={() => { const copy = {...form}; copy.payment_lines = copy.payment_lines || []; copy.payment_lines.push(emptyPaymentLine()); setForm(copy); }}>+ Add another line</Button>
            </Box>
            <Box sx={{mt:2, textAlign:'right', fontWeight:700}}>Total Amount to Pay: PHP {(form.payment_lines || []).reduce((s:any,l:any)=>s + (Number(l.amount)||0), 0)}</Box>
          </Box>

          {/* Journal Entry */}
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
                      <Select fullWidth value={String(line.coa_id || '')} onChange={e => { const copy = {...form}; copy.journal_lines = copy.journal_lines || []; copy.journal_lines[idx] = { ...(copy.journal_lines[idx] || {}), coa_id: e.target.value }; setForm(copy); }}>
                        <MenuItem value="">-- Select COA --</MenuItem>
                        {coas.map((a:any) => <MenuItem key={a.coa_id} value={String(a.coa_id)}>{a.account_name || a.name || a.coa_id}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField fullWidth value={line.debit || ''} onChange={e => { const copy = {...form}; copy.journal_lines = copy.journal_lines || []; copy.journal_lines[idx] = { ...(copy.journal_lines[idx] || {}), debit: e.target.value }; setForm(copy); }} InputProps={{ sx: { textAlign: 'right' } }} />
                    </TableCell>
                    <TableCell>
                      <TextField fullWidth value={line.credit || ''} onChange={e => { const copy = {...form}; copy.journal_lines = copy.journal_lines || []; copy.journal_lines[idx] = { ...(copy.journal_lines[idx] || {}), credit: e.target.value }; setForm(copy); }} InputProps={{ sx: { textAlign: 'right' } }} />
                    </TableCell>
                    <TableCell>
                      <TextField fullWidth value={line.remarks || ''} onChange={e => { const copy = {...form}; copy.journal_lines = copy.journal_lines || []; copy.journal_lines[idx] = { ...(copy.journal_lines[idx] || {}), remarks: e.target.value }; setForm(copy); }} />
                    </TableCell>
                    <TableCell>
                      <Button color="error" onClick={() => { const copy = {...form}; copy.journal_lines = copy.journal_lines || []; copy.journal_lines = copy.journal_lines.filter((_:any,i:number)=>i!==idx); setForm(copy); }}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{mt:1}}>
              <Button onClick={() => { const copy = {...form}; copy.journal_lines = copy.journal_lines || []; copy.journal_lines.push(emptyJournalLine()); setForm(copy); }}>+ Add another line</Button>
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
              <TextField label="Prepared By" value={form.prepared_by || ''} disabled />
              <Autocomplete
                freeSolo
                options={userOptions.map(u => ({ id: u.user_id, label: u.full_name || u.username || String(u.user_id) }))}
                getOptionLabel={(opt:any) => typeof opt === 'string' ? opt : (opt && opt.label) || ''}
                value={(() => {
                  const v = form.reviewed_by;
                  if (!v && v !== 0) return '';
                  if (!isNaN(Number(v))) return userNames[String(v)] || String(v);
                  return v;
                })()}
                onChange={(_, newVal) => {
                  // newVal may be string (manual) or object {id,label}
                  if (!newVal) return setForm({...form, reviewed_by: null});
                  if (typeof newVal === 'string') return setForm({...form, reviewed_by: newVal});
                  return setForm({...form, reviewed_by: newVal.id});
                }}
                renderInput={(params) => <TextField {...params} label="Reviewed By" />}
              />
              <Autocomplete
                freeSolo
                options={userOptions.map(u => ({ id: u.user_id, label: u.full_name || u.username || String(u.user_id) }))}
                getOptionLabel={(opt:any) => typeof opt === 'string' ? opt : (opt && opt.label) || ''}
                value={(() => {
                  const v = form.approved_by;
                  if (!v && v !== 0) return '';
                  if (!isNaN(Number(v))) return userNames[String(v)] || String(v);
                  return v;
                })()}
                onChange={(_, newVal) => {
                  if (!newVal) return setForm({...form, approved_by: null});
                  if (typeof newVal === 'string') return setForm({...form, approved_by: newVal});
                  return setForm({...form, approved_by: newVal.id});
                }}
                renderInput={(params) => <TextField {...params} label="Approved By" />}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { resetForm(); }}>Cancel</Button>
          <Button onClick={async () => { await save(); /* save already closes and fetches; ensure form reset */ resetForm(); }} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Preview / Print dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Preview Check Voucher</DialogTitle>
        <DialogContent>
          {previewItem ? (
            <div id="cv-print-area" style={{padding:20, fontFamily: 'Arial, sans-serif', color: '#000'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                <div>
                  <div style={{fontSize:20, fontWeight:700}}>{previewItem.company ? (previewItem.company.name || previewItem.company.company_name || '') : ''}</div>
                  <div style={{fontSize:12}}>{previewItem.company ? (previewItem.company.address || '') : ''}</div>
                </div>
                <div>
                  {previewItem.company && previewItem.company.logo ? <img src={previewItem.company.logo} alt="logo" style={{height:60}}/> : null}
                </div>
              </div>
              <hr />
              <div style={{display:'flex', justifyContent:'space-between', marginTop:10}}>
                <div>
                  <div><strong>CV Ctrl:</strong> {previewItem.check_voucher_control || previewItem.check_voucher_id}</div>
                  <div><strong>Prepared:</strong> {previewItem.cvoucher_date}</div>
                  <div><strong>Purpose:</strong> {previewItem.purpose}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div><strong>Amount:</strong> PHP {previewItem.check_amount || (previewItem.payment_lines && previewItem.payment_lines.length ? previewItem.payment_lines.reduce((s:any,l:any)=>s + (Number(l.amount)||0),0) : 0)}</div>
                </div>
              </div>
              <div style={{marginTop:20}}>
                <div style={{fontWeight:700}}>Payment Details</div>
                <table style={{width:'100%', borderCollapse:'collapse', marginTop:8}}>
                  <thead>
                    <tr><th style={{borderBottom:'1px solid #ccc', textAlign:'left'}}>Payee</th><th style={{borderBottom:'1px solid #ccc', textAlign:'left'}}>Description</th><th style={{borderBottom:'1px solid #ccc', textAlign:'right'}}>Amount</th></tr>
                  </thead>
                  <tbody>
                    {(previewItem.payment_lines || []).map((l:any, i:number) => (
                      <tr key={i}><td style={{padding:'6px 0'}}>{l.payee_display || l.payee_name || l.payee_contact_id || '-'}</td><td style={{padding:'6px 0'}}>{l.description || ''}</td><td style={{padding:'6px 0', textAlign:'right'}}>{Number(l.amount||0).toFixed(2)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:20}}>
                <div style={{fontWeight:700}}>Journal Entries</div>
                <table style={{width:'100%', borderCollapse:'collapse', marginTop:8}}>
                  <thead>
                    <tr><th style={{borderBottom:'1px solid #ccc', textAlign:'left'}}>COA</th><th style={{borderBottom:'1px solid #ccc', textAlign:'right'}}>Debit</th><th style={{borderBottom:'1px solid #ccc', textAlign:'right'}}>Credit</th></tr>
                  </thead>
                  <tbody>
                    {(previewItem.journal_lines || []).map((j:any, i:number) => (
                      <tr key={i}><td style={{padding:'6px 0'}}>{j.account_name || j.coa_name || j.coa_id || ''}</td><td style={{padding:'6px 0', textAlign:'right'}}>{Number(j.debit||0).toFixed(2)}</td><td style={{padding:'6px 0', textAlign:'right'}}>{Number(j.credit||0).toFixed(2)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:20}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <div style={{textAlign:'center', width:'30%'}}>
                    <div style={{fontWeight:700}}>Prepared By</div>
                    <div style={{marginTop:24}}>__________________</div>
                    <div style={{marginTop:8, fontSize:12}}>{previewItem.prepared_by_name || getSignatoryDisplay(previewItem.prepared_by || previewItem.prepared_by_manual || '')}</div>
                  </div>
                  <div style={{textAlign:'center', width:'30%'}}>
                    <div style={{fontWeight:700}}>Reviewed By</div>
                    <div style={{marginTop:24}}>__________________</div>
                    <div style={{marginTop:8, fontSize:12}}>{previewItem.reviewed_by_name || getSignatoryDisplay(previewItem.reviewed_by || previewItem.reviewed_by_manual || '')}</div>
                  </div>
                  <div style={{textAlign:'center', width:'30%'}}>
                    <div style={{fontWeight:700}}>Approved By</div>
                    <div style={{marginTop:24}}>__________________</div>
                    <div style={{marginTop:8, fontSize:12}}>{previewItem.approved_by_name || getSignatoryDisplay(previewItem.approved_by || previewItem.approved_by_manual || '')}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : <div>No preview data</div>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button onClick={() => previewItem && downloadPdf(previewItem.check_voucher_id)} sx={{mr:1}}>Download PDF</Button>
          <Button onClick={() => {
            const el = document.getElementById('cv-print-area');
            if (!el) { setSnackMsg('Nothing to print'); setSnackSeverity('info'); setSnackOpen(true); return; }
            const printHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Check Voucher</title><style>body{font-family: Arial, sans-serif; color:#000; padding:20px;} table{width:100%;border-collapse:collapse;} th,td{padding:6px 4px;} th{border-bottom:1px solid #ccc;}</style></head><body>${el.innerHTML}<script> (function(){ function doPrint(){ try{ window.focus(); window.print(); }catch(e){ console.error('Print failed', e); } } if(document.readyState==='complete'){ setTimeout(doPrint,50); } else { window.addEventListener('load', function(){ setTimeout(doPrint,50); }); } window.addEventListener('afterprint', function(){ try{ window.close(); }catch(e){} }); })(); </script></body></html>`;
            const win = window.open('', '_blank');
            if (!win) {
              // fallback to iframe
              try {
                const iframe = document.createElement('iframe'); iframe.style.position='fixed'; iframe.style.right='0'; iframe.style.bottom='0'; iframe.style.width='0'; iframe.style.height='0'; iframe.style.border='0'; document.body.appendChild(iframe);
                const idoc = iframe.contentWindow?.document; if (!idoc) throw new Error('iframe doc unavailable'); idoc.open(); idoc.write(printHtml); idoc.close(); const tryPrint = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) { setSnackMsg('Print failed in iframe'); setSnackSeverity('error'); setSnackOpen(true); } setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 500); };
                iframe.onload = tryPrint; setTimeout(tryPrint, 800); return;
              } catch (e:any) { setSnackMsg('Popup blocked and fallback failed. Allow popups or use Download PDF.'); setSnackSeverity('error'); setSnackOpen(true); return; }
            }
            win.document.open(); win.document.write(printHtml); win.document.close();
          }} variant="contained">Print / Save as PDF</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackOpen} autoHideDuration={4000} onClose={() => setSnackOpen(false)}>
        <Alert severity={snackSeverity} sx={{ width: '100%' }}>{snackMsg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default CheckVouchers;
