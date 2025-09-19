import React, { useContext, ReactElement } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import { UserProvider, UserContext } from './UserContext';

import DashboardLayout from './components/DashboardLayout';
import BankingManagement from './pages/BankingManagement';
import APManagement from './pages/APManagement';
import ARManagement from './pages/ARManagement';
import ClientVendorManagement from './pages/ClientVendorManagement';
import ChartOfAccounts from './pages/ChartOfAccounts';
import Payroll from './pages/Payroll';
import Settings from './pages/Settings';

const Dashboard = () => {
  const { user } = useContext(UserContext);
  return <div>Welcome, {user?.username || 'User'}! This is your dashboard.</div>;
};

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user } = useContext(UserContext);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/banking"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <BankingManagement />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ap"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <APManagement />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ar"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ARManagement />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ClientVendorManagement />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coa"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ChartOfAccounts />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payroll"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Payroll />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
  {/* Fallback route for any other path */}
  <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
