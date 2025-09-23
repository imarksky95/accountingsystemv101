import React, { useState, useEffect, useContext } from 'react';
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
import { UserContext } from '../UserContext';

// Basic users fetch for multi-select options
import { buildUrl, tryFetchWithFallback, API_BASE as RESOLVED_API_BASE } from '../apiBase';
console.debug && console.debug('UsersAndRoleSettings: resolved API_BASE =', RESOLVED_API_BASE || '(empty, using fallback)');

function initials(name?: string) {
  if (!name) return '';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function UsersAndRoleSettings() {
  console.debug && console.debug('UsersAndRoleSettings: component render');
  const { roles, loading, updateRole, fetchRoles } = useRoles();
  const { user } = useContext(UserContext);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleReviewers, setNewRoleReviewers] = useState<any[]>([]);
  const [newRoleApprovers, setNewRoleApprovers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role_id: '' });
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserMobile, setNewUserMobile] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selReviewer, setSelReviewer] = useState<any[]>([]);
  const [selApprover, setSelApprover] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'info' }>({ open: false, message: '' });

  useEffect(() => {
    async function fetchUsers() {
      try {
        // Fetch actual users list (requires admin privileges)
        const path = '/api/users';
        console.debug && console.debug('UsersAndRoleSettings: fetching users via tryFetchWithFallback', path);
        const res = await tryFetchWithFallback(path, { cache: 'no-store', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
        if (!res.ok) {
          console.warn('Users API returned non-ok status', res.status);
          setUsers([]);
          return;
        }
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

  // Edit user dialog
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserMobile, setEditUserMobile] = useState('');
  const [editUserRoleId, setEditUserRoleId] = useState<any>('');

  function openUserEditor(u: any) {
    // fetch latest from server in case the users array is stale
    (async () => {
      try {
        const res = await tryFetchWithFallback(`/api/users/${u.user_id}`, { cache: 'no-store', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
        if (res.ok) {
          const fresh = await res.json();
          setEditingUser(fresh);
          setEditUserFullName(fresh.full_name || '');
          setEditUserEmail(fresh.email || '');
          setEditUserMobile(fresh.mobile || '');
          setEditUserRoleId(fresh.role_id || '');
        } else {
          // fallback to existing object
          setEditingUser(u);
          setEditUserFullName(u.full_name || '');
          setEditUserEmail(u.email || '');
          setEditUserMobile(u.mobile || '');
          setEditUserRoleId(u.role_id || '');
        }
      } catch (e) {
        setEditingUser(u);
        setEditUserFullName(u.full_name || '');
        setEditUserEmail(u.email || '');
        setEditUserMobile(u.mobile || '');
        setEditUserRoleId(u.role_id || '');
      }
    })();
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
    <Box p={1}>
      <Grid container alignItems="center" justifyContent="space-between">
        <Grid item>
          <Typography variant="h6">Users and Role Settings</Typography>
          <Typography variant="caption" color="textSecondary">Manage which users can review or approve actions per role.</Typography>
        </Grid>
      </Grid>

      <Box mt={1}>
        {loading ? <CircularProgress /> : (
          roles.length === 0 ? (
            <Box p={2}>
              <Typography>No roles found. Ensure the backend `/api/roles` endpoint is reachable and returns role rows.</Typography>
            </Box>
          ) : (
            <>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="subtitle2">Roles</Typography>
                <Box display="flex" gap={1}>
                  {/* Only show Add Role/User to Super Admin (role_id === 1) */}
                  {user && Number(user.role_id) === 1 ? (
                    <>
                      <Button variant="outlined" onClick={() => setShowAddRole(true)}>Add Role</Button>
                      <Button variant="contained" onClick={() => setShowAddUser(true)}>Add User</Button>
                    </>
                  ) : null}
                </Box>
              </Box>
              <List dense disablePadding>
                {roles.map(r => (
                  <ListItem key={r.role_id} secondaryAction={<Button size="small" onClick={() => openEditor(r)}>Edit</Button>} sx={{ py: 0.5 }}>
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

              <Box mt={1}>
                <Typography variant="subtitle2">Users</Typography>
                <List dense disablePadding>
                  {users.map(u => (
                      <ListItem key={u.user_id} secondaryAction={user && Number(user.role_id) === 1 ? <Button size="small" onClick={() => openUserEditor(u)}>Edit</Button> : null} sx={{ py: 0.5 }}>
                        <ListItemText primary={u.username} secondary={<span style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.6)' }}>{`Role ID: ${u.role_id} • Created: ${u.created_at ? new Date(u.created_at).toLocaleString() : '—'}`}</span>} />
                      </ListItem>
                    ))}
                  {users.length === 0 && <ListItem dense><ListItemText primary="No users found or insufficient permissions." /></ListItem>}
                </List>
              </Box>
            </>
          )
        )}
      </Box>

      <Dialog open={showAddUser} onClose={() => setShowAddUser(false)}>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <Box mt={1} display="flex" flexDirection="column" gap={2}>
            <TextField label="Full name" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} fullWidth />
            <TextField label="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} fullWidth />
            <TextField label="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} fullWidth />
            <TextField label="Email" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} fullWidth />
            <TextField label="Mobile" value={newUserMobile} onChange={(e) => setNewUserMobile(e.target.value)} fullWidth />
            <Autocomplete
              options={roles}
              getOptionLabel={(opt:any) => opt.role_name || String(opt.role_id)}
              onChange={(e, val:any) => setNewUser({ ...newUser, role_id: val ? String(val.role_id) : '' })}
              renderInput={(params) => <TextField {...params} label="Role" />}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddUser(false)}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            const isAdmin = user && Number(user.role_id) === 1;
            if (!isAdmin) {
              setSnack({ open: true, message: 'Forbidden: requires admin role', severity: 'error' });
              setShowAddUser(false);
              return;
            }
            try {
                // validation: email format
                if (newUserEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newUserEmail)) {
                  setSnack({ open: true, message: 'Invalid email format', severity: 'error' });
                  return;
                }
                // normalize mobile: keep digits only, allow leading '+'
                const normalizeMobile = (m: string) => {
                  if (!m) return '';
                  // keep leading + if present, then digits
                  const plus = m.trim().startsWith('+') ? '+' : '';
                  const digits = m.replace(/[^0-9]/g, '');
                  return plus + digits;
                };
                const normalizedMobile = normalizeMobile(newUserMobile);

                const payload: any = { username: newUser.username, password: newUser.password, role_id: Number(newUser.role_id) };
                if (newUserFullName) payload.full_name = newUserFullName;
                if (newUserEmail) payload.email = newUserEmail;
                if (normalizedMobile) payload.mobile = normalizedMobile;
                const url = buildUrl('/api/auth/register');
                const token = localStorage.getItem('token') || '';
                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setSnack({ open: true, message: err.message || 'Failed to add user', severity: 'error' });
                return;
              }
                // use server response to update users list if provided
                const data = await res.json().catch(() => null);
                setSnack({ open: true, message: 'User added', severity: 'success' });
              setShowAddUser(false);
              // Refresh users
              try {
                const res2 = await tryFetchWithFallback('/api/users', { cache: 'no-store', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
                if (res2.ok) {
                  const d = await res2.json();
                  setUsers(Array.isArray(d) ? d : []);
                }
              } catch (e) { /* ignore */ }
            } catch (e) {
              setSnack({ open: true, message: 'Failed to add user', severity: 'error' });
            }
          }}>Add</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showAddRole} onClose={() => setShowAddRole(false)}>
        <DialogTitle>Add Role</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <TextField label="Role Name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} fullWidth />
          </Box>
          <Box mt={2}>
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(opt:any) => opt.username || String(opt.user_id)}
              value={users.filter(u => newRoleReviewers.includes(u.user_id))}
              onChange={(e, value:any[]) => setNewRoleReviewers(value.map(v => v.user_id))}
              renderTags={(value:any[], getTagProps) => value.map((option, index) => (
                <Chip label={option.username} {...getTagProps({ index })} />
              ))}
              renderInput={(params) => <TextField {...params} variant="outlined" label="Reviewer(s)" placeholder="Select reviewers" />}
            />
          </Box>
          <Box mt={2}>
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(opt:any) => opt.username || String(opt.user_id)}
              value={users.filter(u => newRoleApprovers.includes(u.user_id))}
              onChange={(e, value:any[]) => setNewRoleApprovers(value.map(v => v.user_id))}
              renderTags={(value:any[], getTagProps) => value.map((option, index) => (
                <Chip label={option.username} {...getTagProps({ index })} />
              ))}
              renderInput={(params) => <TextField {...params} variant="outlined" label="Approver(s)" placeholder="Select approvers" />}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddRole(false)}>Cancel</Button>
              <Button variant="contained" onClick={async () => {
                if (!newRoleName.trim()) { setSnack({ open: true, message: 'Role name required', severity: 'error' }); return; }
                try {
                  const token = localStorage.getItem('token') || '';
                  const payload: any = { role_name: newRoleName.trim() };
                  if (newRoleReviewers.length) payload.reviewer = newRoleReviewers;
                  if (newRoleApprovers.length) payload.approver = newRoleApprovers;

                  const res = await fetch(buildUrl('/api/roles'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
                    body: JSON.stringify(payload)
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setSnack({ open: true, message: err.error || 'Failed to add role', severity: 'error' });
                    return;
                  }
                  const created = await res.json().catch(() => null);
                  setSnack({ open: true, message: 'Role added', severity: 'success' });
                  setShowAddRole(false);
                  setNewRoleName('');
                  setNewRoleReviewers([]);
                  setNewRoleApprovers([]);
                  // refresh users and roles
                  try {
                    await fetchRoles();
                    const res2 = await tryFetchWithFallback('/api/users', { cache: 'no-store', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
                    if (res2.ok) {
                      const d = await res2.json();
                      setUsers(Array.isArray(d) ? d : []);
                    }
                  } catch (e) { /* ignore */ }
                } catch (e) {
                  setSnack({ open: true, message: 'Failed to add role', severity: 'error' });
                }
              }}>Add</Button>
        </DialogActions>
      </Dialog>

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

      <Dialog open={!!editingUser} onClose={() => setEditingUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box mt={1} display="flex" flexDirection="column" gap={2}>
            <TextField label="Full name" value={editUserFullName} onChange={(e) => setEditUserFullName(e.target.value)} fullWidth />
            <TextField label="Email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} fullWidth />
            <TextField label="Mobile" value={editUserMobile} onChange={(e) => setEditUserMobile(e.target.value)} fullWidth />
            <Autocomplete
              options={roles}
              getOptionLabel={(opt:any) => opt.role_name || String(opt.role_id)}
              value={roles.find(r => Number(r.role_id) === Number(editUserRoleId)) || null}
              onChange={(e, val:any) => setEditUserRoleId(val ? val.role_id : '')}
              renderInput={(params) => <TextField {...params} label="Role" />}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingUser(null)}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            if (!editingUser) return;
            try {
              // email validation
              if (editUserEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(editUserEmail)) {
                setSnack({ open: true, message: 'Invalid email format', severity: 'error' });
                return;
              }
              const normalizeMobile = (m: string) => {
                if (!m) return '';
                const plus = m.trim().startsWith('+') ? '+' : '';
                const digits = m.replace(/[^0-9]/g, '');
                return plus + digits;
              };
              const normalizedMobile = normalizeMobile(editUserMobile);

              const payload: any = { full_name: editUserFullName, email: editUserEmail, mobile: normalizedMobile, role_id: Number(editUserRoleId) };
              const token = localStorage.getItem('token') || '';
              const res = await fetch(buildUrl(`/api/users/${editingUser.user_id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
              if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                setSnack({ open: true, message: e.error || 'Failed to update user', severity: 'error' });
                return;
              }
              const updated = await res.json().catch(() => null);
              setSnack({ open: true, message: 'User updated', severity: 'success' });
              setEditingUser(null);
              // Refresh users
              try {
                const res2 = await tryFetchWithFallback('/api/users', { cache: 'no-store', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
                if (res2.ok) {
                  const d = await res2.json();
                  setUsers(Array.isArray(d) ? d : []);
                }
              } catch (e) { /* ignore */ }
            } catch (e) {
              setSnack({ open: true, message: 'Failed to update user', severity: 'error' });
            }
          }}>Save</Button>
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
