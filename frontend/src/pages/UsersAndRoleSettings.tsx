import React, { useState, useEffect } from 'react';
import { useRoles } from '../hooks/useRoles';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Autocomplete,
  TextField,
  Chip,
  Avatar,
  Snackbar,
  Alert,
  Grid,
  Typography
} from '@mui/material';

// Basic users fetch for multi-select options
let API_BASE = (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL !== '')
  ? process.env.REACT_APP_API_BASE_URL
  : (window?.location?.origin || '');
API_BASE = API_BASE.replace(/\/$/, '');
console.debug && console.debug('UsersAndRoleSettings: resolved API_BASE =', API_BASE);

function initials(name?: string) {
  if (!name) return '';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function UsersAndRoleSettings() {
  const { roles, loading, updateRole } = useRoles();
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selReviewer, setSelReviewer] = useState<any[]>([]);
  const [selApprover, setSelApprover] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'info' }>({ open: false, message: '' });

  useEffect(() => {
    async function fetchUsers() {
      try {
          const path = '/api/contacts';
          const url = API_BASE ? `${API_BASE}${path}` : path;
          console.debug && console.debug('UsersAndRoleSettings: fetching users', url);
          const fallback = 'https://accountingsystemv101-1.onrender.com' + path;
          let res = await fetch(url, { cache: 'no-store' }).catch(err => {
            console.warn('UsersAndRoleSettings: primary fetch failed, trying fallback', err && err.message ? err.message : err);
            return fetch(fallback, { cache: 'no-store' });
          });
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
      setSnack({ open: true, message: 'Role updated', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: 'Failed to save role', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box p={2}>
      <Grid container alignItems="center" justifyContent="space-between">
        <Grid item>
          <Typography variant="h5">Users and Role Settings</Typography>
          <Typography variant="body2" color="textSecondary">Manage which users can review or approve actions per role.</Typography>
        </Grid>
      </Grid>

      <Box mt={2}>
        {loading ? <CircularProgress /> : (
          roles.length === 0 ? (
            <Box p={2}>
              <Typography>No roles found. Ensure the backend `/api/roles` endpoint is reachable and returns role rows.</Typography>
            </Box>
          ) : (
            <List>
              {roles.map(r => (
                <ListItem key={r.role_id} secondaryAction={<Button onClick={() => openEditor(r)}>Edit</Button>}>
                  <ListItemText
                    primary={r.role_name}
                    secondary={
                      <>
                        <strong>Reviewers:</strong> {(r.reviewer || []).map((id: any) => String(id)).join(', ') || '—'}
                        <br />
                        <strong>Approvers:</strong> {(r.approver || []).map((id: any) => String(id)).join(', ') || '—'}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Role</DialogTitle>
        <DialogContent>
          <Box mt={1} mb={2}>
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(opt) => opt.display_name || opt.contact_control || String(opt.contact_id)}
              value={users.filter(u => selReviewer.includes(u.contact_id))}
              onChange={(e, value) => setSelReviewer(value.map(v => v.contact_id))}
              filterSelectedOptions
              renderTags={(value: any[], getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.display_name || option.contact_control}
                    avatar={<Avatar>{initials(option.display_name)}</Avatar>}
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={(params) => <TextField {...params} variant="outlined" label="Reviewer(s)" placeholder="Search users..." />}
            />
          </Box>

          <Box mt={1} mb={2}>
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(opt) => opt.display_name || opt.contact_control || String(opt.contact_id)}
              value={users.filter(u => selApprover.includes(u.contact_id))}
              onChange={(e, value) => setSelApprover(value.map(v => v.contact_id))}
              filterSelectedOptions
              renderTags={(value: any[], getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.display_name || option.contact_control}
                    avatar={<Avatar>{initials(option.display_name)}</Avatar>}
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={(params) => <TextField {...params} variant="outlined" label="Approver(s)" placeholder="Search users..." />}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} variant="contained">{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.severity || 'info'} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
