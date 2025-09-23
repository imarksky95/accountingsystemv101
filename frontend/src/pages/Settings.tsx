
import React, { useRef, useState, useEffect } from 'react';
import { useCompany } from '../CompanyContext';
import { Box, Typography, Paper, Divider, TextField, Button, MenuItem, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete } from '@mui/material';
import { buildUrl, tryFetchWithFallback, API_BASE as RESOLVED_API_BASE } from '../apiBase';
import UsersAndRoleSettings from './UsersAndRoleSettings';

const companyTypes = [
  'Freelancer',
  'Sole Proprietor',
  'Corporation',
  'Non Profit Organization',
];

console.debug && console.debug('Settings: resolved API_BASE =', RESOLVED_API_BASE || '(empty, using fallback)');

const Settings: React.FC = () => {
  const { setCompanyName } = useCompany();
  const [profile, setProfile] = useState({
    logo: '',
    company_name: '',
    address: '',
    tin: '',
    company_type: '',
  });
  // initial logo preview state and file input ref
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [showAccountEditor, setShowAccountEditor] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile((prev) => ({ ...prev, company_type: e.target.value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Client-side validation: allowed mime types and max size
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      const maxBytes = Number(process.env.REACT_APP_COMPANY_LOGO_MAX_BYTES || 1048576);
      if (!allowed.includes(file.type)) { alert('Unsupported logo type. Allowed: png, jpeg, webp'); return; }
      if (file.size > maxBytes) { alert(`Selected logo is too large (max ${maxBytes} bytes)`); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setProfile((prev) => ({ ...prev, logo: base64 }));
        setLogoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  

  const handleSave = async () => {
    setSaving(true);
    try {
      // Try primary API base then fallback to explicit backend host on failure
      const payload = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) };
      let res;
      try {
        res = await tryFetchWithFallback('/api/company-profile', payload);
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      } catch (e) {
        throw e;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');
      setProfile({ logo: data.logo || '', company_name: data.company_name || '', address: data.address || '', tin: data.tin || '', company_type: data.company_type || '' });
      setLogoPreview(data.logo || null);
      if (data.company_name) setCompanyName(data.company_name);
      alert('Company Profile saved!');
    } catch (err: any) {
      console.error('Save profile error', err);
      alert('Failed to save Company Profile: ' + (err.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  // Load existing profile on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await tryFetchWithFallback('/api/company-profile');
        const data = await res.json();
        if (!mounted) return;
        setProfile({
          logo: data.logo || '',
          company_name: data.company_name || data.NAME || data.name || '',
          address: data.address || '',
          tin: data.tin || '',
          company_type: data.company_type || data.TYPE || '',
        });
        setLogoPreview(data.logo || null);
        if (data.company_name) setCompanyName(data.company_name);
      } catch (err) {
        console.debug('Settings: failed to load profile', err);
      }
    };
    load();
    return () => { mounted = false; };
  }, [setCompanyName]);

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Settings</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Company Profile</Typography>
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar src={logoPreview || undefined} sx={{ width: 64, height: 64, mr: 2 }} />
          <Button variant="contained" component="label">
            Upload Logo
            <input
              type="file"
              accept="image/*"
              hidden
              ref={fileInputRef}
              onChange={handleLogoChange}
            />
          </Button>
        </Box>
        <TextField
          label="Company Name"
          name="company_name"
          value={profile.company_name}
          onChange={handleInputChange}
          fullWidth
          margin="dense"
        />
        <TextField
          label="Company Address"
          name="address"
          value={profile.address}
          onChange={handleInputChange}
          fullWidth
          margin="dense"
        />
        <TextField
          label="Company TIN#"
          name="tin"
          value={profile.tin}
          onChange={handleInputChange}
          fullWidth
          margin="dense"
        />
        <TextField
          select
          label="Company Type"
          name="company_type"
          value={profile.company_type}
          onChange={handleTypeChange}
          fullWidth
          margin="dense"
        >
          {companyTypes.map((type) => (
            <MenuItem key={type} value={type}>{type}</MenuItem>
          ))}
        </TextField>
        <Box mt={2}>
          <Button variant="contained" color="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </Box>
      </Paper>
      <Divider />
      <Paper sx={{ p: 2, mb: 2, mt: 2 }}>
        <Typography variant="h6">Tax Setup</Typography>
        <Typography color="textSecondary">Tax setup options will be managed here.</Typography>
      </Paper>
      <Divider />
      <Paper sx={{ p: 2, mb: 2, mt: 2 }}>
        <Typography variant="h6">Account Settings</Typography>
        <Typography color="textSecondary">Account settings will be managed here.</Typography>
        <Box mt={2}>
          <Button variant="outlined" onClick={() => setShowAccountEditor(true)}>Edit Account</Button>
        </Box>
      </Paper>
      <Divider />
      <Paper sx={{ p: 2, mb: 2, mt: 2 }}>
        <UsersAndRoleSettings />
      </Paper>

      {/* Account editor dialog */}
      <AccountEditor
        open={showAccountEditor}
        onClose={() => setShowAccountEditor(false)}
      />
    </Box>
  );
};

export default Settings;

// --- AccountEditor component ---

function AccountEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLoading] = React.useState(false);
  const [values, setValues] = React.useState<any>({ full_name: '', email: '', mobile: '', reviewer_id: '', approver_id: '', reviewer_manual: '', approver_manual: '' });
  const [reviewerManualMode, setReviewerManualMode] = React.useState(false);
  const [approverManualMode, setApproverManualMode] = React.useState(false);
  const [reviewerOptions, setReviewerOptions] = React.useState<any[]>([]);
  const [approverOptions, setApproverOptions] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(buildUrl('/api/account'), { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
        if (res.ok) {
          const data = await res.json();
          setValues(data || {});
          // initialize manual-mode flags based on presence of manual name fields
          setReviewerManualMode(!!(data && data.reviewer_manual));
          setApproverManualMode(!!(data && data.approver_manual));
        }
        // load reviewer/approver lists filtered by role_type
        const rres = await fetch(buildUrl('/api/users/public?role_type=reviewer'));
        if (rres.ok) { setReviewerOptions(await rres.json()); }
        const ares = await fetch(buildUrl('/api/users/public?role_type=approver'));
        if (ares.ok) { setApproverOptions(await ares.json()); }
      } catch (e) {
        console.error('AccountEditor load error', e);
      } finally { setLoading(false); }
    })();
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Account</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <TextField label="Full name" value={values.full_name || ''} onChange={(e) => setValues((v:any) => ({ ...v, full_name: e.target.value }))} fullWidth />
          <TextField label="Email" value={values.email || ''} onChange={(e) => setValues((v:any) => ({ ...v, email: e.target.value }))} fullWidth />
          <TextField label="Mobile" value={values.mobile || ''} onChange={(e) => setValues((v:any) => ({ ...v, mobile: e.target.value }))} fullWidth />

          <Box display="flex" alignItems="center" gap={1}>
            <input type="checkbox" id="reviewerManual" checked={reviewerManualMode} onChange={(e) => {
              const manual = e.target.checked;
              setReviewerManualMode(manual);
              setValues((v:any) => ({ ...v, reviewer_manual: manual ? (v.reviewer_manual || '') : '' , reviewer_id: manual ? '' : v.reviewer_id }));
            }} />
            <label htmlFor="reviewerManual">Manual reviewer name</label>
          </Box>
          {reviewerManualMode ? (
            <TextField label="Reviewer (manual name)" value={values.reviewer_manual || ''} onChange={(e) => setValues((v:any) => ({ ...v, reviewer_manual: e.target.value }))} fullWidth />
          ) : (
            <Autocomplete
              options={reviewerOptions}
              getOptionLabel={(opt:any) => opt.full_name || opt.username || ''}
              value={reviewerOptions.find(r => Number(r.user_id) === Number(values.reviewer_id)) || null}
              onChange={(e, val:any) => setValues((v:any) => ({ ...v, reviewer_id: val ? val.user_id : '' }))}
              renderInput={(params) => <TextField {...params} label="Reviewer (select)" />}
              freeSolo
            />
          )}

          <Box display="flex" alignItems="center" gap={1}>
            <input type="checkbox" id="approverManual" checked={approverManualMode} onChange={(e) => {
              const manual = e.target.checked;
              setApproverManualMode(manual);
              setValues((v:any) => ({ ...v, approver_manual: manual ? (v.approver_manual || '') : '' , approver_id: manual ? '' : v.approver_id }));
            }} />
            <label htmlFor="approverManual">Manual approver name</label>
          </Box>
          {approverManualMode ? (
            <TextField label="Approver (manual name)" value={values.approver_manual || ''} onChange={(e) => setValues((v:any) => ({ ...v, approver_manual: e.target.value }))} fullWidth />
          ) : (
            <Autocomplete
              options={approverOptions}
              getOptionLabel={(opt:any) => opt.full_name || opt.username || ''}
              value={approverOptions.find(r => Number(r.user_id) === Number(values.approver_id)) || null}
              onChange={(e, val:any) => setValues((v:any) => ({ ...v, approver_id: val ? val.user_id : '' }))}
              renderInput={(params) => <TextField {...params} label="Approver (select)" />}
              freeSolo
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={async () => {
          try {
            const token = localStorage.getItem('token') || '';
            const payload: any = { full_name: values.full_name, email: values.email, mobile: values.mobile, reviewer_id: values.reviewer_id, approver_id: values.approver_id, reviewer_manual: values.reviewer_manual, approver_manual: values.approver_manual };
            const res = await fetch(buildUrl('/api/account'), { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to save account'); return; }
            alert('Account updated');
            onClose();
          } catch (e) { console.error('Account save error', e); alert('Failed to save account'); }
  }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
