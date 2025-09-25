import React, { useContext, ReactElement, Suspense } from 'react';
import { CompanyProvider } from './CompanyContext';
import { Route, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import { UserContext } from './UserContext';

// Lazy-load heavy dashboard components so login page loads quickly without the dashboard bundle
const DashboardLayout = React.lazy(() => import('./components/DashboardLayout'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const BankingManagement = React.lazy(() => import('./pages/BankingManagement'));
const APManagement = React.lazy(() => import('./pages/APManagement'));
const ARManagement = React.lazy(() => import('./pages/ARManagement'));
const Contacts = React.lazy(() => import('./pages/Contacts'));
const ChartOfAccounts = React.lazy(() => import('./pages/ChartOfAccounts'));
const Payroll = React.lazy(() => import('./pages/Payroll'));
const Settings = React.lazy(() => import('./pages/Settings'));
const UsersAndRoleSettings = React.lazy(() => import('./pages/UsersAndRoleSettings'));

// ...existing code... (dashboard page moved to ./pages/Dashboard)

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user } = useContext(UserContext);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <CompanyProvider>
    <Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div>Loading dashboard...</div>}>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/banking"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div>Loading banking...</div>}>
                <DashboardLayout>
                  <BankingManagement />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ap"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div>Loading AP...</div>}>
                <DashboardLayout>
                  <APManagement />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ar"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div>Loading AR...</div>}>
                <DashboardLayout>
                  <ARManagement />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div>Loading contacts...</div>}>
                <DashboardLayout>
                  <Contacts />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coa"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div>Loading COA...</div>}>
                <DashboardLayout>
                  <ChartOfAccounts />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payroll"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div>Loading payroll...</div>}>
                <DashboardLayout>
                  <Payroll />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div>Loading settings...</div>}>
                <DashboardLayout>
                  <Settings />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles-settings"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div>Loading role settings...</div>}>
                <DashboardLayout>
                  <UsersAndRoleSettings />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />
  {/* Fallback route for any other path */}
  <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </CompanyProvider>
  );
}

export default App;
