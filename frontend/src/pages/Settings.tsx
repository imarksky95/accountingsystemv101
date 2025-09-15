
import React, { useRef, useState, useEffect } from 'react';
import { Box, Typography, Paper, Divider, TextField, Button, MenuItem, Avatar } from '@mui/material';

const companyTypes = [
  'Freelancer',
  'Sole Proprietor',
  'Corporation',
  'Non Profit Organization',
];

const Settings: React.FC = () => {
  const [profile, setProfile] = useState({
    logo: '',
    name: '',
    address: '',
    tin: '',
    type: '',
  });
  // Load company profile from backend on mount
  useEffect(() => {
    fetch('/api/company-profile')
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        if (data.logo) setLogoPreview(data.logo);
        if (data.name) localStorage.setItem('companyName', data.name);
      });
  }, []);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load company profile from backend on mount and after save
  const loadProfile = () => {
    fetch('/api/company-profile')
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        if (data.logo) setLogoPreview(data.logo);
        if (data.name) localStorage.setItem('companyName', data.name);
      });
  };
  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async () => {
    // Save to backend
    await fetch('/api/company-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    // Save company name to localStorage for header
    localStorage.setItem('companyName', profile.name);
    loadProfile();
    alert('Company Profile saved!');
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
          <Button variant="contained" color="primary" onClick={handleSave}>Save</Button>
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
