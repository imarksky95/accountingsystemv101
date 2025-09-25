
import React, { useContext, useState } from 'react';
import { Box, CssBaseline, AppBar, Toolbar, Typography, Avatar, IconButton, Tooltip, Button, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../UserContext';
import { useCompany } from '../CompanyContext';

const navItems = [
  { text: 'Dashboard', path: '/dashboard' },
  { text: 'Banking Management', path: '/banking' },
  { text: 'AP Management', path: '/ap' },
  { text: 'AR Management', path: '/ar' },
  { text: 'Contacts', path: '/contacts' },
  { text: 'Chart of Accounts', path: '/coa' },
  { text: 'Payroll', path: '/payroll' },
  { text: 'Settings', path: '/settings' },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useContext(UserContext);

  // Use companyName from CompanyContext
  const { companyName } = useCompany();

  // Compute display name, initials (first+last), and deterministic bg color based on user_id
  const displayName = (user && (user.full_name || user.username)) || 'User';
  const initials = (() => {
    const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    const first = parts[0][0] || '';
    const last = parts[parts.length - 1][0] || '';
    return (first + last).toUpperCase();
  })();

  const avatarBg = (() => {
    const palette = ['#F44336','#E91E63','#9C27B0','#673AB7','#3F51B5','#2196F3','#03A9F4','#00BCD4','#009688','#4CAF50','#8BC34A','#CDDC39','#FFC107','#FF9800','#FF5722','#795548'];
    const id = user && user.user_id ? Number(user.user_id) : 0;
    return palette[id % palette.length];
  })();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  // Mobile menu anchor
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar position="static" color="primary">
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              onClick={() => navigate('/dashboard')}
              color="inherit"
              aria-label={`Home - ${companyName}`}
              sx={{ textTransform: 'none', fontSize: '1.125rem', fontWeight: 600, p: 0 }}
            >
              {companyName}
            </Button>
            <Box role="navigation" aria-label="Primary" sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
              {navItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Button
                    key={item.text}
                    onClick={() => navigate(item.path)}
                    role="link"
                    aria-current={active ? 'page' : undefined}
                    sx={{
                      textTransform: 'none',
                      color: active ? (theme: any) => theme.palette.getContrastText(theme.palette.secondary.main) : 'inherit',
                      backgroundColor: active ? (theme: any) => theme.palette.secondary.main : 'transparent',
                      borderRadius: '999px',
                      px: 2,
                      py: 0.5,
                      minHeight: 36,
                      '&:hover': { backgroundColor: active ? (theme: any) => theme.palette.secondary.dark : (theme: any) => theme.palette.action.hover },
                      '&:focus-visible': { outline: (theme: any) => `3px solid ${theme.palette.primary.light}`, outlineOffset: '2px' },
                    }}
                  >
                    {item.text}
                  </Button>
                );
              })}
            </Box>
            <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
              <IconButton color="inherit" onClick={handleMenuOpen} aria-label="Open main menu" id="nav-menu-button">
                <MenuIcon />
              </IconButton>
              <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose} aria-label="Main menu" id="main-menu" MenuListProps={{ 'aria-labelledby': 'nav-menu-button' }}>
                {navItems.map((item) => (
                  <MenuItem key={item.text} onClick={() => { handleMenuClose(); navigate(item.path); }}>
                    {item.text}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ textAlign: 'right', mr: 1 }}>
              <Typography variant="body2">{displayName}</Typography>
            </Box>
            <Tooltip title="Account">
              <IconButton onClick={() => navigate('/profile')} aria-label={`Account of ${displayName}`}>
                <Avatar sx={{ bgcolor: avatarBg }}>{initials}</Avatar>
              </IconButton>
            </Tooltip>
            <Button color="inherit" onClick={handleLogout} aria-label="Logout">Logout</Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}>
        {children}
      </Box>
    </Box>
  );
};

export default DashboardLayout;
