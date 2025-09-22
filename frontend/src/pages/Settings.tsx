
import React, { useRef, useState, useEffect } from 'react';
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
  const [profile, setProfile] = useState({
    logo: '',
    name: '',
    address: '',
    tin: '',
    type: '',
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
    setProfile((prev) => ({ ...prev, type: e.target.value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setProfile((prev) => ({ ...prev, logo: base64 }));
        setLogoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Load company profile from backend (single entry with id=1)
  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/company-profile`);
      if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
      const data = await res.json();
      setProfile({ logo: data.logo || '', name: data.name || '', address: data.address || '', tin: data.tin || '', type: data.type || '' });
      setLogoPreview(data.logo || null);
      if (data.name) localStorage.setItem('companyName', data.name);
    } catch (err:any) {
      console.error('loadProfile error', err);
    }
  };
  useEffect(() => { loadProfile(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/company-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Save failed: ${res.status}`);
      }
      const data = await res.json();
      // Update local state with returned profile if provided
      if (data && data.profile) {
        const p = data.profile;
        setProfile({ logo: p.logo || '', name: p.name || '', address: p.address || '', tin: p.tin || '', type: p.type || '' });
        setLogoPreview(p.logo || null);
        if (p.name) localStorage.setItem('companyName', p.name);
      } else {
        // Fallback: reload from server
        await loadProfile();
      }
      alert('Company Profile saved!');
    } catch (err:any) {
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
          name="name"
          value={profile.name}
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
          name="type"
          value={profile.type}
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
