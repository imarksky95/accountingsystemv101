
import React, { useRef, useState } from 'react';
import { useCompany } from '../CompanyContext';
import { Box, Typography, Paper, Divider, TextField, Button, MenuItem, Avatar } from '@mui/material';

const companyTypes = [
  'Freelancer',
  'Sole Proprietor',
  'Corporation',
  'Non Profit Organization',
];

//API base recognition (can be overridden at build time)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://accountingsystemv101-1.onrender.com';

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
      const res = await fetch(`${API_BASE_URL}/api/company-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
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
      </Paper>
      <Divider />
      <Paper sx={{ p: 2, mb: 2, mt: 2 }}>
        <Typography variant="h6">User Settings</Typography>
        <Typography color="textSecondary">User settings will be managed here.</Typography>
      </Paper>
    </Box>
  );
};

export default Settings;
