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
  Typography,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper
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
  
  const [newRoleType, setNewRoleType] = useState<'none'|'reviewer'|'approver'|'both'>('none');
  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role_id: '' });
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserMobile, setNewUserMobile] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  
  const [editRoleType, setEditRoleType] = useState<'none'|'reviewer'|'approver'|'both'>('none');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'info' }>({ open: false, message: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [showDeleteRoleConfirm, setShowDeleteRoleConfirm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<any | null>(null);
  const [showRoleDeleteBlocked, setShowRoleDeleteBlocked] = useState(false);
  const [roleDeleteBlockedUsers, setRoleDeleteBlockedUsers] = useState<any[]>([]);

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
    // infer role_type from stored field if present
    setEditRoleType(role.role_type || 'none');
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

  

  const [tabIndex, setTabIndex] = useState(0);

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
            <>
              <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 2 }}>
                <Tab label="Users" />
                <Tab label="Roles" />
              </Tabs>

              {tabIndex === 0 && (
                <>
                  <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
                    <Box>
                      {user && Number(user.role_id) === 1 && (
                        <>
                          <Button variant="contained" size="small" onClick={() => setShowAddUser(true)}>ADD USER</Button>
                        </>
                      )}
                    </Box>
                  </Box>

                  <Paper>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Full Name</TableCell>
                          <TableCell>Username</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell>Created At</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {users.map(u => (
                          <TableRow key={u.user_id}>
                            <TableCell>{u.full_name || '—'}</TableCell>
                            <TableCell>{u.username}</TableCell>
                            <TableCell>{(roles.find(r => Number(r.role_id) === Number(u.role_id)) || {}).role_name || `ID ${u.role_id}`}</TableCell>
                            <TableCell>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</TableCell>
                            <TableCell align="right">
                              {user && Number(user.role_id) === 1 ? (
                                <>
                                  <Button size="small" onClick={() => openUserEditor(u)}>Edit</Button>
                                    <Button size="small" onClick={() => { setUserToDelete(u); setShowDeleteConfirm(true); }} sx={{ ml: 1 }}>Delete</Button>
                                </>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                        {users.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5}>No users found or insufficient permissions.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Paper>
                </>
              )}

              {tabIndex === 1 && (
                <>
                  <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
                    {user && Number(user.role_id) === 1 && (
                      <Button variant="outlined" size="small" onClick={() => setShowAddRole(true)}>ADD ROLE</Button>
                    )}
                  </Box>

                  <List dense disablePadding>
                    {roles.map(r => (
                      <ListItem key={r.role_id} sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={r.role_name}
                          secondary={<><strong>Type:</strong> {(r.role_type || 'none').toString()}</>}
                        />
                        <Box>
                          {user && Number(user.role_id) === 1 && (
                            <>
                              <Button size="small" onClick={() => openEditor(r)}>Edit</Button>
                              <Button size="small" color="error" sx={{ ml: 1 }} onClick={() => {
                                const assigned = Array.isArray(users) ? users.filter(u => Number(u.role_id) === Number(r.role_id)) : [];
                                if (assigned.length > 0) {
                                  setRoleToDelete(r);
                                  setRoleDeleteBlockedUsers(assigned);
                                  setShowRoleDeleteBlocked(true);
                                } else {
                                  setRoleToDelete(r);
                                  setShowDeleteRoleConfirm(true);
                                }
                              }}>Delete</Button>
                            </>
                          )}
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
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
            <TextField select label="Role Type" value={newRoleType} onChange={(e) => setNewRoleType(e.target.value as any)} fullWidth SelectProps={{ native: true }}>
              <option value="none">None</option>
              <option value="reviewer">Reviewer</option>
              <option value="approver">Approver</option>
              <option value="both">Both</option>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddRole(false)}>Cancel</Button>
              <Button variant="contained" onClick={async () => {
                if (!newRoleName.trim()) { setSnack({ open: true, message: 'Role name required', severity: 'error' }); return; }
                try {
                  const token = localStorage.getItem('token') || '';
                  const payload: any = { role_name: newRoleName.trim(), role_type: newRoleType };

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
                  setNewRoleType('none');
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
            <TextField select label="Role Type" value={editRoleType} onChange={(e) => setEditRoleType(e.target.value as any)} fullWidth SelectProps={{ native: true }}>
              <option value="none">None</option>
              <option value="reviewer">Reviewer</option>
              <option value="approver">Approver</option>
              <option value="both">Both</option>
            </TextField>
          </Box>

          {/* Role now driven exclusively by role_type; reviewer/approver pickers removed */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={async () => {
            if (!editing) return;
            setSaving(true);
            try {
              const payload: any = { role_type: editRoleType };
              await updateRole(editing.role_id, payload);
              setOpen(false);
              setSnack({ open: true, message: 'Role updated', severity: 'success' });
            } catch (e) {
              setSnack({ open: true, message: 'Failed to save role', severity: 'error' });
            } finally {
              setSaving(false);
            }
          }} disabled={saving} variant="contained">{saving ? 'Saving...' : 'Save'}</Button>
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

      <Dialog open={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setUserToDelete(null); }}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete the user <strong>{userToDelete ? userToDelete.username : ''}</strong>? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowDeleteConfirm(false); setUserToDelete(null); }}>Cancel</Button>
            <Button variant="contained" onClick={async () => {
            if (!userToDelete) return;
            try {
              const token = localStorage.getItem('token') || '';
              const res = await fetch(buildUrl(`/api/users/${userToDelete.user_id}`), { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setSnack({ open: true, message: err.error || 'Failed to delete user', severity: 'error' });
                return;
              }
              setSnack({ open: true, message: 'User deleted', severity: 'success' });
              setShowDeleteConfirm(false);
              setUserToDelete(null);
              try {
                const res2 = await tryFetchWithFallback('/api/users', { cache: 'no-store', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
                if (res2.ok) {
                  const d = await res2.json();
                  setUsers(Array.isArray(d) ? d : []);
                }
              } catch (e) { /* ignore */ }
            } catch (e) {
              setSnack({ open: true, message: 'Failed to delete user', severity: 'error' });
            }
          }} color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showDeleteRoleConfirm} onClose={() => { setShowDeleteRoleConfirm(false); setRoleToDelete(null); }}>
        <DialogTitle>Delete Role</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete the role <strong>{roleToDelete ? roleToDelete.role_name : ''}</strong>? This may fail if users are assigned to this role.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowDeleteRoleConfirm(false); setRoleToDelete(null); }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={async () => {
            if (!roleToDelete) return;
            try {
              const token = localStorage.getItem('token') || '';
              const res = await fetch(buildUrl(`/api/roles/${roleToDelete.role_id}`), { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setSnack({ open: true, message: err.error || 'Failed to delete role', severity: 'error' });
                return;
              }
              setSnack({ open: true, message: 'Role deleted', severity: 'success' });
              setShowDeleteRoleConfirm(false);
              setRoleToDelete(null);
              try { await fetchRoles(); } catch (e) { /* ignore */ }
            } catch (e) {
              setSnack({ open: true, message: 'Failed to delete role', severity: 'error' });
            }
          }}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showRoleDeleteBlocked} onClose={() => { setShowRoleDeleteBlocked(false); setRoleDeleteBlockedUsers([]); setRoleToDelete(null); }} fullWidth maxWidth="sm">
        <DialogTitle>Cannot Delete Role</DialogTitle>
        <DialogContent>
          <Typography>This role has users assigned. Re-assign those users to a different role before deleting.</Typography>
          <Box mt={2}>
            {roleDeleteBlockedUsers.map(u => (
              <Box key={u.user_id} display="flex" justifyContent="space-between" sx={{ py: 0.5 }}>
                <Typography>{u.username}</Typography>
                <Typography color="textSecondary">{(roles.find(r => Number(r.role_id) === Number(u.role_id)) || {}).role_name || `ID ${u.role_id}`}</Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowRoleDeleteBlocked(false); setRoleDeleteBlockedUsers([]); setRoleToDelete(null); }}>Close</Button>
          <Button variant="contained" onClick={() => { setShowRoleDeleteBlocked(false); setRoleDeleteBlockedUsers([]); setTabIndex(0); }}>Go to Users</Button>
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
