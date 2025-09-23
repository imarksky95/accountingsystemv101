
import React, { useContext, useState } from 'react';
import { Box, CssBaseline, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemIcon, ListItemText, Avatar, ListItemButton, IconButton, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PeopleIcon from '@mui/icons-material/People';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import PaidIcon from '@mui/icons-material/Paid';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../UserContext';
import { useCompany } from '../CompanyContext';

const drawerWidth = 240;

const navItems = [
  { text: 'Banking Management', icon: <AccountBalanceIcon />, path: '/banking' },
  { text: 'AP Management', icon: <PaymentIcon />, path: '/ap' },
  { text: 'AR Management', icon: <ReceiptIcon />, path: '/ar' },
  { text: 'Contacts', icon: <PeopleIcon />, path: '/contacts' },
  { text: 'Chart of Accounts', icon: <ListAltIcon />, path: '/coa' },
  { text: 'Payroll', icon: <PaidIcon />, path: '/payroll' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useContext(UserContext);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  const handleToggle = () => setCollapsed((prev) => !prev);

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

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleToggle} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {companyName}
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: collapsed ? 72 : drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: collapsed ? 72 : drawerWidth,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            transition: 'width 0.2s',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
                <>
                  <Avatar sx={{ bgcolor: avatarBg, width: 64, height: 64, mb: 1 }}>{initials}</Avatar>
                  {!collapsed && <Typography variant="subtitle1">{displayName}</Typography>}
                </>
          {!collapsed && (
            <ListItemButton sx={{ mt: 2, color: 'red' }} onClick={handleLogout}>
              <ListItemText primary="Logout" />
            </ListItemButton>
          )}
        </Box>
        <List>
          {navItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ justifyContent: 'center' }}>
              <Tooltip title={item.text} placement="right" disableHoverListener={!collapsed}>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  sx={{ justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 2 : 3 }}
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 2, justifyContent: 'center' }}>{item.icon}</ListItemIcon>
                  {!collapsed && <ListItemText primary={item.text} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default DashboardLayout;
