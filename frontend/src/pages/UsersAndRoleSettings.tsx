import React, { useState, useEffect } from 'react';
import { useRoles } from '../hooks/useRoles';
import { Box, Button, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, CircularProgress } from '@mui/material';

// Basic users fetch for multi-select options
const API_BASE = (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL !== '')
  ? process.env.REACT_APP_API_BASE_URL
  : (window?.location?.origin || '');

export default function UsersAndRoleSettings() {
  const { roles, loading, updateRole } = useRoles();
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selReviewer, setSelReviewer] = useState<any[]>([]);
  const [selApprover, setSelApprover] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch(`${API_BASE}/api/contacts`, { cache: 'no-store' });
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to fetch users', e);
      }
    }
    fetchUsers();
  }, []);

  function openEditor(role: any) {
    setEditing(role);
    setSelReviewer(Array.isArray(role.reviewer) ? role.reviewer : []);
    setSelApprover(Array.isArray(role.approver) ? role.approver : []);
    setOpen(true);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateRole(editing.role_id, { reviewer: selReviewer, approver: selApprover });
      setOpen(false);
    } catch (e) {
      alert('Failed to save role: ' + String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box p={2}>
      <h2>Users and Role Settings</h2>
      {loading ? <CircularProgress /> : (
        <List>
          {roles.map(r => (
            <ListItem key={r.role_id} secondaryAction={<Button onClick={() => openEditor(r)}>Edit</Button>}>
              <ListItemText primary={r.role_name} secondary={`Reviewers: ${JSON.stringify(r.reviewer)} • Approvers: ${JSON.stringify(r.approver)}`} />
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Role</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel id="reviewer-label">Reviewer(s)</InputLabel>
            <Select
              labelId="reviewer-label"
              multiple
              value={selReviewer}
              onChange={(e) => setSelReviewer(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as any[])}
              renderValue={(selected) => (selected as any[]).map(s => String(s)).join(', ')}
            >
              {users.map(u => (
                <MenuItem key={u.contact_id} value={u.contact_id}>{u.display_name || u.contact_control}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel id="approver-label">Approver(s)</InputLabel>
            <Select
              labelId="approver-label"
              multiple
              value={selApprover}
              onChange={(e) => setSelApprover(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as any[])}
              renderValue={(selected) => (selected as any[]).map(s => String(s)).join(', ')}
            >
              {users.map(u => (
                <MenuItem key={u.contact_id} value={u.contact_id}>{u.display_name || u.contact_control}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} variant="contained">{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
