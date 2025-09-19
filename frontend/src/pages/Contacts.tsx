import React, { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, MenuItem, Select, InputLabel, FormControl
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://accountingsystemv101.onrender.com';

interface Contact {
  contact_id: number;
  contact_control: string;
  display_name: string;
  contact_type: string;
  contact_info: string;
  created_at: string;
}

const CONTACT_TYPES = ['Customer', 'Vendor', 'Employee'];

const Contacts: React.FC = () => {
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmId, setConfirmId] = useState<number | null>(null);
  const [form, setForm] = useState({ contact_control: '', display_name: '', contact_type: '', contact_info: '' });

  const fetchContacts = async () => {
    setLoading(true);
    try {
  const res = await window.fetch(`${API_BASE_URL}/api/contacts`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetch contacts failed', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchContacts(); }, []);

  const handleOpen = (it?: Contact) => {
    // Blur any currently focused element to avoid aria-hidden warnings
    const maybeBlurActiveElement = () => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
    maybeBlurActiveElement();
    if (it) {
      setEditId(it.contact_id);
      setForm({ contact_control: it.contact_control, display_name: it.display_name, contact_type: it.contact_type || '', contact_info: it.contact_info || '' });
    } else {
      setEditId(null);
      setForm({ contact_control: '', display_name: '', contact_type: '', contact_info: '' });
    }
    setOpen(true);
  };
  const handleClose = () => { setOpen(false); setEditId(null); };

  const handleSubmit = async () => {
    try {
      let res;
      const token = localStorage.getItem('token');
      if (!token) {
        alert('You must be logged in to perform this action.');
        return;
      }
      const authHeader = { Authorization: `Bearer ${token}` };
      if (editId) {
        const payload: any = { display_name: form.display_name, contact_type: form.contact_type, contact_info: form.contact_info };
        if (form.contact_control) payload.contact_control = form.contact_control;
        res = await window.fetch(`${API_BASE_URL}/api/contacts/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(payload) });
      } else {
        const payload = { display_name: form.display_name, contact_type: form.contact_type, contact_info: form.contact_info };
        res = await window.fetch(`${API_BASE_URL}/api/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(payload) });
      }
      if (!res.ok) throw new Error('Save failed');
      await fetchContacts();
      handleClose();
    } catch (e) {
      alert('Save failed');
    }
  };

  const handleDelete = async (id: number) => {
    // Blur active element before opening confirm dialog to prevent aria-hidden focus issues
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setConfirmId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!confirmId) return;
    try {
      await window.fetch(`${API_BASE_URL}/api/contacts/${confirmId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      setConfirmOpen(false);
      setConfirmId(null);
      await fetchContacts();
    } catch (e) {
      alert('Delete failed');
    }
  };

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Contacts</Typography>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ mb: 2 }}>Add Contact</Button>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Contact Control #</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Contact Info</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map(it => (
              <TableRow key={it.contact_id}>
                <TableCell>{it.contact_control}</TableCell>
                <TableCell>{it.display_name}</TableCell>
                <TableCell>{it.contact_type}</TableCell>
                <TableCell>{it.contact_info}</TableCell>
                <TableCell>{new Date(it.created_at).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpen(it)}><EditIcon /></IconButton>
                  <IconButton color="error" onClick={() => handleDelete(it.contact_id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && !loading && (
              <TableRow><TableCell colSpan={6} align="center">No contacts found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editId ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Contact Control #"
            name="contact_control"
            value={form.contact_control}
            onChange={(e) => setForm({...form, contact_control: e.target.value})}
            fullWidth
            disabled={!editId}
            helperText={!editId ? 'Auto-generated' : ''}
          />
          <TextField autoFocus margin="dense" label="Display Name" name="display_name" value={form.display_name} onChange={(e) => setForm({...form, display_name: e.target.value})} fullWidth />
          <FormControl fullWidth margin="dense">
            <InputLabel id="contact-type-label">Contact Type</InputLabel>
            <Select labelId="contact-type-label" name="contact_type" value={form.contact_type} label="Contact Type" onChange={(e:any) => setForm({...form, contact_type: e.target.value})}>
              <MenuItem value=""><em>None</em></MenuItem>
              {CONTACT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField margin="dense" label="Contact Info" name="contact_info" value={form.contact_info} onChange={(e) => setForm({...form, contact_info: e.target.value})} fullWidth multiline rows={3} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">{editId ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>Are you sure you want to delete this contact?</DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Contacts;
