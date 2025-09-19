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
      setContacts(Array.isArray(contactRes.data) ? contactRes.data : []);
      setCoas(Array.isArray(coaRes.data) ? coaRes.data : []);
    } catch (e:any) {
      console.error('fetchAll error', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, preparation_date: new Date().toISOString().slice(0,10), prepared_by: user?.user_id || null }); setOpen(true); };
  const openEdit = (pv: any) => { setEditing(pv); setForm({ ...pv }); setOpen(true); };

  const save = async () => {
    try {
      const token = localStorage.getItem('token');
      const payload = { ...form, prepared_by: form.prepared_by || user?.user_id || null };
      // If payee was selected from contacts, ensure we send the contact_id as string
      if (form.payee) payload.payee = String(form.payee);
      if (editing) {
        await axios.put(`${API_BASE}/api/payment-vouchers/${editing.payment_voucher_id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        setSnackMsg('Payment voucher updated');
      } else {
        await axios.post(`${API_BASE}/api/payment-vouchers`, payload, { headers: { Authorization: `Bearer ${token}` } });
        setSnackMsg('Payment voucher created');
      }
      setSnackSeverity('success');
      setSnackOpen(true);
      setOpen(false);
      fetchAll();
    } catch (e:any) {
      setSnackMsg(e.response?.data?.error || e.message || 'Save failed');
      setSnackSeverity('error');
      setSnackOpen(true);
    }
  };

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

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Payment Voucher' : 'New Payment Voucher'}<IconButton aria-label="close" onClick={() => setOpen(false)} sx={{position:'absolute', right:8, top:8}}><CloseIcon /></IconButton></DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{mt:1}}>
            <TextField label="Preparation Date" type="date" value={form.preparation_date || ''} onChange={e => setForm({...form, preparation_date: e.target.value})} InputLabelProps={{ shrink: true }} />
          </FormControl>
          <FormControl fullWidth sx={{mt:1}}>
            <TextField label="Purpose" value={form.purpose || ''} onChange={e => setForm({...form, purpose: e.target.value})} />
          </FormControl>
          <FormControl fullWidth sx={{mt:1}}>
            <InputLabel id="payee-label">Payee</InputLabel>
            <Select labelId="payee-label" value={String(form.payee || form.payee_id || '')} label="Payee" onChange={e => setForm({...form, payee: e.target.value})}>
              <MenuItem value="">-- Select Payee --</MenuItem>
              {contacts.map(c => <MenuItem key={c.contact_id} value={String(c.contact_id)}>{c.display_name}</MenuItem>)}
            </Select>
            <div style={{marginTop:8}}><Button size="small" onClick={() => window.location.href = '/contacts'}>Add New Contact</Button></div>
          </FormControl>
          <FormControl fullWidth sx={{mt:1}}>
            <InputLabel id="coa-label">Chart of Accounts</InputLabel>
            <Select labelId="coa-label" value={form.coa_id || ''} label="Chart of Accounts" onChange={e => setForm({...form, coa_id: e.target.value})}>
              <MenuItem value="">-- Select COA --</MenuItem>
              {coas.map((a:any) => <MenuItem key={a.coa_id} value={a.coa_id}>{a.account_name || a.name || `${a.coa_id}`}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{mt:1}}>
            <TextField label="Amount" type="number" value={form.amount_to_pay || ''} onChange={e => setForm({...form, amount_to_pay: e.target.value})} />
          </FormControl>
          <FormControl fullWidth sx={{mt:1}}>
            <TextField label="Description" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} multiline rows={3} />
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} variant="contained">Save</Button>
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
