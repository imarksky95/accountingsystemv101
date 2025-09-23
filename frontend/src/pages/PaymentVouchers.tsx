import React, { useState, useContext, useRef } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Snackbar, Alert, CircularProgress, IconButton, Table, TableHead, TableRow, TableCell, TableBody, Checkbox } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import { UserContext, User } from '../UserContext';
import { buildUrl, tryFetchWithFallback, API_BASE as RESOLVED_API_BASE } from '../apiBase';
import { formatDateToMMDDYYYY } from '../utils/date';
console.debug && console.debug('PaymentVouchers: resolved API_BASE =', RESOLVED_API_BASE || '(empty, using fallback)');

interface PaymentLine { payee_id?: string | number; payee_contact_id?: number | null; payee_name?: string; payee_display?: string; description?: string; amount?: number | string }
interface JournalLine { coa_id?: string | number | null; debit?: number | string; credit?: number | string; remarks?: string }
interface PVForm {
  status?: string;
  preparation_date?: string;
  purpose?: string;
  paid_through?: string;
  prepared_by?: number | string | null;
  description?: string;
  payment_lines?: PaymentLine[];
  journal_lines?: JournalLine[];
  reviewed_by?: number | string;
  approved_by?: number | string;
}

const emptyForm: PVForm = {
  status: 'Draft',
  preparation_date: '',
  purpose: '',
  paid_through: '',
  prepared_by: null,
  description: '',
  payment_lines: [],
  journal_lines: [],
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
  const [form, setForm] = useState<PVForm>(emptyForm);
  const [expectedControl, setExpectedControl] = useState<string>('');
  const firstFocusRef = useRef<HTMLInputElement | null>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<any | null>(null);

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
      // Fetch payment vouchers, contacts, and coas independently so one failure doesn't block the others
  let pvResData: Array<any> = [];
      try {
  const pvRes = await axios.get(buildUrl('/api/payment-vouchers'));
        pvResData = Array.isArray(pvRes.data) ? pvRes.data : [];
      } catch (err:any) {
        console.error('payment-vouchers fetch error', err?.response?.data || err.message || err);
        // keep pvResData as empty array
      }
      setItems(pvResData);
      // Seed userNames cache from any prepared_by_username in the fetched PVs
      try {
        const seed: Record<string,string> = {};
        const idsToFetch = new Set<string>();
        for (const p of pvResData) {
          if (p.prepared_by_username) seed[String(p.prepared_by)] = p.prepared_by_username;
          else if (p.prepared_by && !isNaN(Number(p.prepared_by))) {
            const sid = String(p.prepared_by);
            // queue numeric ids that we don't already have in cache
            if (!userNames[sid]) idsToFetch.add(sid);
          }
        }
        if (Object.keys(seed).length) setUserNames(prev => ({ ...prev, ...seed }));
        if (idsToFetch.size) {
          const token = localStorage.getItem('token');
          await Promise.all(Array.from(idsToFetch).map(async id => {
            try {
              const r = await axios.get(buildUrl(`/api/users/${id}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
              if (r && r.data) setUserNames(prev => ({ ...prev, [id]: r.data.full_name || r.data.username || id }));
            } catch (e) {
              // don't block others; leave id unresolved
            }
          }));
        }
      } catch (e) {}

      // Contacts
  let fetchedContacts: Array<{ contact_id: number; display_name: string; contact_type?: string }> = [];
      try {
  const contactRes = await axios.get(buildUrl('/api/contacts'));
        fetchedContacts = Array.isArray(contactRes.data) ? contactRes.data : [];
      } catch (err:any) {
        console.error('contacts fetch error', err?.response?.data || err.message || err);
        fetchedContacts = [];
      }

      // if no contacts returned, try vendors as fallback
      if (fetchedContacts.length === 0) {
        try {
          const vendRes = await axios.get(buildUrl('/api/vendors'));
          const vendors = Array.isArray(vendRes.data) ? vendRes.data : [];
          // Map vendors to contact-like shape
          const mapped = vendors.map(v => ({ contact_id: v.vendor_id, display_name: v.name, contact_type: 'Vendor' }));
          console.log('contacts empty; using vendors fallback count=', mapped.length, mapped.slice(0,5));
          setContacts(mapped);
        } catch (e:any) {
          console.error('vendors fallback fetch error', e?.response?.data || e.message || e);
          setContacts([]);
        }
      } else {
        console.log('contacts fetched count=', fetchedContacts.length, fetchedContacts.slice(0,5));
        setContacts(fetchedContacts);
      }

      // COA
      try {
  const coaRes = await axios.get(buildUrl('/api/coa/all/simple'));
        const c = Array.isArray(coaRes.data) ? coaRes.data : [];
        console.log('coas fetched count=', c.length, c.slice(0,5));
        setCoas(c);
      } catch (err:any) {
        console.warn('coa fetch primary failed, trying fallback', err?.response?.data || err.message || err);
        try {
          const fb = await axios.get(buildUrl('/api/coa/all/simple/fallback'));
          const c2 = Array.isArray(fb.data) ? fb.data : [];
          console.log('coa fetched fallback count=', c2.length, c2.slice(0,5));
          setCoas(c2);
        } catch (err2:any) {
          console.error('coa fetch fallback failed', err2?.response?.data || err2.message || err2);
          setCoas([]);
        }
      }
    } catch (e:any) {
      console.error('fetchAll error', e);
    } finally { setLoading(false); }
  };

  const fetchCoas = async () => {
    try {
      // Use the same simple fetch style as `Contacts.tsx` for consistent behavior
  const res = await tryFetchWithFallback('/api/coa/all/simple');
      if (!res.ok) throw new Error(`COA primary fetch failed: ${res.status}`);
      const data = await res.json();
      const c = Array.isArray(data) ? data : [];
      setCoas(c);
      return c;
    } catch (err:any) {
      console.warn('coa fetch primary failed, trying fallback', err?.message || err);
      try {
  const fbRes = await tryFetchWithFallback('/api/coa/all/simple/fallback');
        if (!fbRes.ok) throw new Error(`COA fallback fetch failed: ${fbRes.status}`);
        const data2 = await fbRes.json();
        const c2 = Array.isArray(data2) ? data2 : [];
        setCoas(c2);
        return c2;
      } catch (err2:any) {
        console.error('coa fetch fallback failed', err2?.message || err2);
        setCoas([]);
        return [];
      }
    }
  };

  const fetchContacts = async () => {
    try {
  const contactRes = await axios.get(buildUrl('/api/contacts'));
      const fetchedContacts = Array.isArray(contactRes.data) ? contactRes.data : [];
      if (!fetchedContacts || fetchedContacts.length === 0) {
        // fallback to vendors
        try {
          const vendRes = await axios.get(buildUrl('/api/vendors'));
          const vendors = Array.isArray(vendRes.data) ? vendRes.data : [];
          const mapped = vendors.map((v:any) => ({ contact_id: v.vendor_id, display_name: v.name, contact_type: 'Vendor' }));
          setContacts(mapped);
          return mapped;
        } catch (e:any) {
          console.error('vendors fallback fetch error', e?.response?.data || e.message || e);
          setContacts([]);
          return [];
        }
      }
      setContacts(fetchedContacts);
      return fetchedContacts;
    } catch (err:any) {
      console.error('contacts fetch error', err?.response?.data || err.message || err);
      setContacts([]);
      return [];
    }
  };

  const openNew = async () => {
    await Promise.all([fetchContacts(), fetchCoas()]);
    // compute expected control based on current count (matches backend behavior)
    try {
  const res = await axios.get(buildUrl('/api/payment-vouchers/simple'));
      const rows = Array.isArray(res.data) ? res.data : [];
      setExpectedControl(`PV-${rows.length + 1}`);
    } catch (e:any) {
      console.warn('failed to compute expected control', e?.response?.data || e.message || e);
      setExpectedControl('');
    }
    setEditing(null);
    // Refresh current user from server to ensure workflow fields are up-to-date
  let refreshedUser: User | null = null;
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get(buildUrl('/api/auth/me'), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (resp && resp.data) refreshedUser = resp.data;
    } catch (e) {
      // fallback to local context
      refreshedUser = user as User | null;
    }
    // derive signatories from refreshed user's workflow settings (prefer id then manual)
  let reviewed_by_val: number | string = '';
  let approved_by_val: number | string = '';
    try {
      const me: User | null = refreshedUser as User | null;
      if (me) {
        const _me: User = me;
        if (_me.reviewer_id) reviewed_by_val = _me.reviewer_id;
        else if (_me.reviewer_manual) reviewed_by_val = _me.reviewer_manual as string;
        if (_me.approver_id) approved_by_val = _me.approver_id;
        else if (_me.approver_manual) approved_by_val = _me.approver_manual as string;
      }
      // seed userNames cache with current user's full_name for prepared_by
      if (me && me.user_id) {
        setUserNames(prev => ({ ...prev, [String(me.user_id)]: me.full_name || me.username || String(me.user_id) }));
      }
      // seed reviewer/approver names from refreshed user workflow if numeric
      try {
        const token = localStorage.getItem('token');
        if (me && me.reviewer_id && !isNaN(Number(me.reviewer_id))) {
          const rid = String(me.reviewer_id);
          axios.get(buildUrl(`/api/users/${rid}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then(r => { if (r && r.data) setUserNames(prev => ({ ...prev, [rid]: r.data.full_name || r.data.username || rid })); })
            .catch(() => {});
        }
        if (me && me.approver_id && !isNaN(Number(me.approver_id))) {
          const aid = String(me.approver_id);
          axios.get(buildUrl(`/api/users/${aid}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then(r => { if (r && r.data) setUserNames(prev => ({ ...prev, [aid]: r.data.full_name || r.data.username || aid })); })
            .catch(() => {});
        }
      } catch (e) {}
    } catch (e) {}

    setForm({
      ...emptyForm,
      preparation_date: new Date().toISOString().slice(0,10),
      prepared_by: (refreshedUser && refreshedUser.user_id) ? refreshedUser.user_id : (user?.user_id || null),
      reviewed_by: reviewed_by_val,
      approved_by: approved_by_val,
      // note: do not store separate display fields here; rely on userNames cache and user.full_name
      // ensure at least one payment_line and one journal_line so selects render options
      payment_lines: [{ payee_id: '', description: '', amount: 0 }],
      journal_lines: [{ coa_id: '', debit: 0, credit: 0, remarks: '' }]
    });
    // If reviewed_by/approved_by are numeric IDs, resolve their full_name for display
    try {
      const token = localStorage.getItem('token');
      if (reviewed_by_val && !isNaN(Number(reviewed_by_val))) {
        const id = String(reviewed_by_val);
        axios.get(buildUrl(`/api/users/${id}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .then(r => { if (r && r.data) {
            setUserNames(prev => ({ ...prev, [id]: r.data.full_name || r.data.username || id }));
          } })
          .catch(() => { /* ignore - we'll fallback to manual string in rendering */ });
      }
      if (approved_by_val && !isNaN(Number(approved_by_val))) {
        const id2 = String(approved_by_val);
        axios.get(buildUrl(`/api/users/${id2}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .then(r => { if (r && r.data) {
            setUserNames(prev => ({ ...prev, [id2]: r.data.full_name || r.data.username || id2 }));
          } })
          .catch(() => { /* ignore - manual fallback handled in UI */ });
      }
    } catch (e) {}
    setOpen(true);
  };
  interface PVItem { payment_voucher_id?: number; payment_voucher_control?: string; payment_lines?: PaymentLine[]; journal_lines?: JournalLine[]; reviewed_by?: number | string; reviewed_by_manual?: string; approved_by?: number | string; approved_by_manual?: string; prepared_by?: number | string }
  const openEdit = async (pv: PVItem) => {
    await Promise.all([fetchContacts(), fetchCoas()]);
    setEditing(pv);
    setExpectedControl(pv.payment_voucher_control || '');
    setForm({
      ...pv,
      payment_lines: pv.payment_lines && pv.payment_lines.length ? pv.payment_lines : [{ payee_id: '', description: '', amount: 0 }],
      journal_lines: pv.journal_lines && pv.journal_lines.length ? pv.journal_lines : [{ coa_id: '', debit: 0, credit: 0, remarks: '' }],
      reviewed_by: pv.reviewed_by || pv.reviewed_by_manual || '',
      approved_by: pv.approved_by || pv.approved_by_manual || ''
    });
    setOpen(true);
    // Resolve prepared_by, reviewer, and approver numeric IDs to full_name (seed userNames cache)
    try {
      const token = localStorage.getItem('token');
      const idsToResolve: string[] = [];
      const rid = pv.reviewed_by || pv.reviewed_by_manual || '';
      const aid = pv.approved_by || pv.approved_by_manual || '';
      const pid = pv.prepared_by || '';
      if (rid && !isNaN(Number(rid))) idsToResolve.push(String(rid));
      if (aid && !isNaN(Number(aid))) idsToResolve.push(String(aid));
      if (pid && !isNaN(Number(pid))) idsToResolve.push(String(pid));
      for (const id of Array.from(new Set(idsToResolve))) {
        axios.get(buildUrl(`/api/users/${id}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .then(r => { if (r && r.data) setUserNames(prev => ({ ...prev, [id]: r.data.full_name || r.data.username || id })); })
          .catch(() => { /* ignore */ });
      }
    } catch (e) {}
  };

  // Prefetch data on mount for the overview and dialog selects
  React.useEffect(() => {
    fetchAll();
  }, []);

  // When dialog opens, move focus into the dialog to avoid leaving focus
  // on an element that will be aria-hidden (prevents accessibility console warnings).
  React.useEffect(() => {
    if (open) {
      // slight delay to allow dialog to mount
      setTimeout(() => { try { firstFocusRef.current?.focus(); } catch (e) {} }, 0);
    }
  }, [open]);

  React.useEffect(() => {
    // fetch company profile for header
    tryFetchWithFallback('/api/company-profile', { cache: 'no-store' })
      .then(r => r.ok ? r.json().then(d => setCompanyProfile(d)) : setCompanyProfile(null))
      .catch(() => setCompanyProfile(null));
  }, []);

  const downloadPdf = async (pvId: number | string | undefined) => {
    if (!pvId) return;
    try {
      const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await tryFetchWithFallback(`/api/payment-vouchers/${pvId}/pdf`, { headers });
      if (!resp.ok) {
        const txt = await resp.text();
        let msg = txt;
        try { msg = JSON.parse(txt).error || txt; } catch (e) { msg = txt; }
        setSnackMsg(msg || `PDF request failed: ${resp.status}`);
        setSnackSeverity('error'); setSnackOpen(true);
        return;
      }
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/pdf')) {
        const txt = await resp.text();
        let msg = txt;
        try { msg = JSON.parse(txt).error || txt; } catch (e) { msg = txt; }
        setSnackMsg(msg || 'Server did not return a PDF'); setSnackSeverity('error'); setSnackOpen(true);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const disp = resp.headers.get('content-disposition') || '';
      let filename = 'voucher.pdf';
      const m = /filename="?([^";]+)"?/.exec(disp);
      if (m && m[1]) filename = m[1];
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e:any) {
      setSnackMsg(e?.message || 'Download failed'); setSnackSeverity('error'); setSnackOpen(true);
    }
  };

  

  const confirmDelete = (id: number) => { setDeleteId(id); setConfirmOpen(true); };
  const doDelete = async () => {
    if (deleteId == null) return;
    try {
      const token = localStorage.getItem('token');
  await axios.delete(buildUrl(`/api/payment-vouchers/${deleteId}`), { headers: { Authorization: `Bearer ${token}` } });
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
  const amount_to_pay = items.filter(p => ids.includes(p.payment_voucher_id)).reduce((s, p) => s + (Number(p.amount_to_pay) || (p.payment_lines && p.payment_lines.length ? p.payment_lines.reduce((ss:any,l:any)=>ss + (Number(l.amount)||0),0) : 0) ), 0);
    setCreatingDR(true);
    try {
      const token = localStorage.getItem('token');
  await axios.post(buildUrl('/api/disbursement-reports'), {
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
              <TableCell>Prepared Date</TableCell>
              <TableCell>Purpose</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map(pv => (
              <TableRow key={pv.payment_voucher_id}>
                <TableCell><Checkbox checked={!!selected[pv.payment_voucher_id]} onChange={() => toggleSelect(pv.payment_voucher_id)} /></TableCell>
                <TableCell>{pv.payment_voucher_control}</TableCell>
                <TableCell>{pv.prepared_by_username || (pv.prepared_by && !isNaN(Number(pv.prepared_by)) ? (userNames[String(pv.prepared_by)] || String(pv.prepared_by)) : (pv.prepared_by || ''))}</TableCell>
                <TableCell>{formatDateToMMDDYYYY(pv.preparation_date)}</TableCell>
                <TableCell>{pv.purpose || '-'}</TableCell>
                <TableCell>{pv.amount_to_pay || (pv.payment_lines && pv.payment_lines.length ? pv.payment_lines.reduce((s:any,l:any)=>s + (Number(l.amount)||0),0) : 0)}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => openEdit(pv)} sx={{mr:1}}>Edit</Button>
                  <Button size="small" color="error" onClick={() => confirmDelete(pv.payment_voucher_id)} sx={{mr:1}}>Delete</Button>
                  <Button size="small" onClick={() => { setPreviewItem(pv); setPreviewOpen(true); }}>Preview</Button>
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
        <DialogTitle>{editing ? `Edit Payment Voucher (${expectedControl || (editing && editing.payment_voucher_control) || ''})` : `New Payment Voucher${expectedControl ? ' (expected: ' + expectedControl + ')' : ''}`}<IconButton aria-label="close" onClick={() => setOpen(false)} sx={{position:'absolute', right:8, top:8}}><CloseIcon /></IconButton></DialogTitle>
        <DialogContent>
          {/* Basic Details */}
          <Box sx={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb:2}}>
            <TextField inputRef={firstFocusRef} label="Preparation Date" type="date" value={form.preparation_date || ''} onChange={e => setForm({...form, preparation_date: e.target.value})} InputLabelProps={{ shrink: true }} />
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
                        const v = e.target.value; const copy = {...form}; copy.payment_lines = copy.payment_lines || [];
                        copy.payment_lines[idx] = { ...(copy.payment_lines[idx] || {}), payee_id: v, payee_name: contacts.find(c=>String(c.contact_id)===String(v))?.display_name || '' };
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
              <Button onClick={() => {
                const copy = {...form};
                copy.payment_lines = copy.payment_lines || [];
                copy.payment_lines.push({payee_id:'', description:'', amount:0});
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
                <TextField label="Prepared By" value={(() => {
                  // If editing and prepared_by numeric, prefer cached name, else use current user's full name
                  const pid = form && form.prepared_by;
                  if (pid && !isNaN(Number(pid))) return userNames[String(pid)] || String(pid);
                  return user?.full_name || user?.username || '';
                })()} disabled />
                <TextField label="Reviewed By" value={(():any => {
                  // Prefer explicitly set form value
                  let v = form.reviewed_by;
                  // fallback to current user's workflow settings if form not seeded
                  if (!v) {
                    const _u: User | null = user as User | null;
                    v = (_u && _u.reviewer_id) ? _u.reviewer_id : (_u && _u.reviewer_manual ? _u.reviewer_manual : '');
                  }
                  if (!v) return '';
                  if (!isNaN(Number(v))) return userNames[String(v)] || String(v);
                  return v || '';
                })()} onChange={e => setForm({...form, reviewed_by: e.target.value})} />
                <TextField label="Approved By" value={(():any => {
                  let v = form.approved_by;
                  if (!v) {
                    const _u: User | null = user as User | null;
                    v = (_u && _u.approver_id) ? _u.approver_id : (_u && _u.approver_manual ? _u.approver_manual : '');
                  }
                  if (!v) return '';
                  if (!isNaN(Number(v))) return userNames[String(v)] || String(v);
                  return v || '';
                })()} onChange={e => setForm({...form, approved_by: e.target.value})} />
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

            const payload = {
              status: form.status || 'Draft',
              preparation_date: form.preparation_date,
              purpose: form.purpose,
              paid_through: form.paid_through || 'Bank',
              prepared_by: user?.user_id || null,
              description: form.description || '',
              payment_lines: mappedPaymentLines,
              journal_lines: (form.journal_lines || []).map((l:any) => ({ coa_id: l.coa_id || null, debit: Number(l.debit)||0, credit: Number(l.credit)||0, remarks: l.remarks || '' })),
              reviewed_by: form.reviewed_by,
              approved_by: form.approved_by
            };
            try {
              const token = localStorage.getItem('token');
              if (editing) {
                await axios.put(buildUrl(`/api/payment-vouchers/${editing.payment_voucher_id}`), payload, { headers: { Authorization: `Bearer ${token}` } });
                setSnackMsg('Payment Voucher updated'); setSnackSeverity('success'); setSnackOpen(true); setOpen(false); fetchAll();
              } else {
                const res = await axios.post(buildUrl('/api/payment-vouchers'), payload, { headers: { Authorization: `Bearer ${token}` } });
                const ctrl = res.data && res.data.payment_voucher_control ? res.data.payment_voucher_control : null;
                setSnackMsg(ctrl ? `Payment Voucher created (${ctrl})` : 'Payment Voucher created'); setSnackSeverity('success'); setSnackOpen(true); setOpen(false); fetchAll();
              }
            } catch (err:any) { setSnackMsg(err.response?.data?.error || err.message || 'Save failed'); setSnackSeverity('error'); setSnackOpen(true); }
          }} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Preview / Print dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Preview Payment Voucher</DialogTitle>
        <DialogContent>
          {previewItem ? (
            <div id="pv-print-area" style={{padding:20, fontFamily: 'Arial, sans-serif', color: '#000'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                <div>
                  <div style={{fontSize:20, fontWeight:700}}>{companyProfile?.name || 'Company Name'}</div>
                  <div style={{fontSize:12}}>{companyProfile?.address || ''}</div>
                </div>
                <div>
                  {companyProfile?.logo ? <img src={companyProfile.logo} alt="logo" style={{height:60}} /> : null}
                </div>
              </div>
              <hr />
              <div style={{display:'flex', justifyContent:'space-between', marginTop:10}}>
                <div>
                  <div><strong>PV Ctrl:</strong> {previewItem.payment_voucher_control}</div>
                  <div><strong>Prepared:</strong> {formatDateToMMDDYYYY(previewItem.preparation_date)}</div>
                  <div><strong>Purpose:</strong> {previewItem.purpose}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div><strong>Amount:</strong> PHP {previewItem.amount_to_pay || (previewItem.payment_lines && previewItem.payment_lines.length ? previewItem.payment_lines.reduce((s:any,l:any)=>s + (Number(l.amount)||0),0) : 0)}</div>
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
                      <tr key={i}><td style={{padding:'6px 0'}}>{l.payee_display || l.payee_name || l.payee_contact_id || '-'}</td><td style={{padding:'6px 0'}}>{l.description || ''}</td><td style={{padding:'6px 0', textAlign:'right'}}>{Number(l.amount).toFixed(2)}</td></tr>
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
                      <tr key={i}><td style={{padding:'6px 0'}}>{j.coa_id || j.account_name || j.coa_name || ''}</td><td style={{padding:'6px 0', textAlign:'right'}}>{Number(j.debit||0).toFixed(2)}</td><td style={{padding:'6px 0', textAlign:'right'}}>{Number(j.credit||0).toFixed(2)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div>No preview data</div>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button onClick={() => previewItem && downloadPdf(previewItem.payment_voucher_id)} sx={{mr:1}}>Download PDF</Button>
          <Button onClick={() => {
            const el = document.getElementById('pv-print-area');
            if (!el) {
              setSnackMsg('Nothing to print'); setSnackSeverity('info'); setSnackOpen(true); return;
            }
            // Embed a small script that triggers print when the new window finishes loading.
            // This avoids calling print asynchronously from the opener (which many browsers block).
            const printHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Payment Voucher</title><style>body{font-family: Arial, sans-serif; color:#000; padding:20px;} table{width:100%;border-collapse:collapse;} th,td{padding:6px 4px;} th{border-bottom:1px solid #ccc;}</style></head><body>${el.innerHTML}<script> (function(){ function doPrint(){ try{ window.focus(); window.print(); }catch(e){ console.error('Print failed', e); } } if(document.readyState==='complete'){ setTimeout(doPrint,50); } else { window.addEventListener('load', function(){ setTimeout(doPrint,50); }); } window.addEventListener('afterprint', function(){ try{ window.close(); }catch(e){} }); })(); </script></body></html>`;
            const win = window.open('', '_blank');
            if (!win) {
              // Popup blocked — fallback to printing via a hidden iframe which is less likely to be blocked.
              try {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
                document.body.appendChild(iframe);
                const idoc = iframe.contentWindow?.document;
                if (!idoc) throw new Error('iframe doc unavailable');
                idoc.open();
                idoc.write(printHtml);
                idoc.close();
                const tryPrint = () => {
                  try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) { console.error('Iframe print failed', e); setSnackMsg('Print failed in iframe'); setSnackSeverity('error'); setSnackOpen(true); }
                  setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 500);
                };
                // Some browsers need onload
                iframe.onload = tryPrint;
                // fallback timeout
                setTimeout(tryPrint, 800);
                return;
              } catch (e:any) {
                console.error('Print fallback failed', e);
                setSnackMsg('Popup blocked and fallback failed. Allow popups or use Download PDF.'); setSnackSeverity('error'); setSnackOpen(true);
                return;
              }
            }
            win.document.open();
            win.document.write(printHtml);
            win.document.close();
          }} variant="contained">Print / Save as PDF</Button>
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
