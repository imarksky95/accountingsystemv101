
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

const drawerWidth = 240;

const navItems = [
  { text: 'Banking Management', icon: <AccountBalanceIcon />, path: '/banking' },
  { text: 'AP Management', icon: <PaymentIcon />, path: '/ap' },
  { text: 'AR Management', icon: <ReceiptIcon />, path: '/ar' },
  { text: 'Client & Vendor Management', icon: <PeopleIcon />, path: '/clients-vendors' },
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

  // Read company name from localStorage (fallback to default)
  const companyName = localStorage.getItem('companyName') || 'Cash Management System';

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
          <Avatar sx={{ width: 64, height: 64, mb: 1 }}>{user?.username ? user.username[0].toUpperCase() : 'U'}</Avatar>
          {!collapsed && <Typography variant="subtitle1">{user?.username || 'User'}</Typography>}
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
