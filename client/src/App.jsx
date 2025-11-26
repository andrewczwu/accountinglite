import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AccountView from './pages/AccountView';
import ReportsView from './pages/ReportsView';
import UsersView from './pages/UsersView';
import CategoriesView from './pages/CategoriesView';
import CustomersView from './pages/CustomersView';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TenantSelection from './pages/TenantSelection';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider, useTenant } from './context/TenantContext';

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

function RequireTenant({ children }) {
  const { currentTenant, loading } = useTenant();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!currentTenant) return <TenantSelection />;
  return children;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <TenantProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={
              <PrivateRoute>
                <RequireTenant>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </RequireTenant>
              </PrivateRoute>
            } />
            <Route path="/banking" element={
              <PrivateRoute>
                <RequireTenant>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </RequireTenant>
              </PrivateRoute>
            } />
            <Route path="/accounts/:id" element={
              <PrivateRoute>
                <RequireTenant>
                  <Layout>
                    <AccountView />
                  </Layout>
                </RequireTenant>
              </PrivateRoute>
            } />
            <Route path="/reports" element={
              <PrivateRoute>
                <RequireTenant>
                  <Layout>
                    <ReportsView />
                  </Layout>
                </RequireTenant>
              </PrivateRoute>
            } />
            <Route path="/users" element={
              <PrivateRoute>
                <RequireTenant>
                  <Layout>
                    <UsersView />
                  </Layout>
                </RequireTenant>
              </PrivateRoute>
            } />
            <Route path="/customers" element={
              <PrivateRoute>
                <RequireTenant>
                  <Layout>
                    <CustomersView />
                  </Layout>
                </RequireTenant>
              </PrivateRoute>
            } />
            <Route path="/categories" element={
              <PrivateRoute>
                <RequireTenant>
                  <Layout>
                    <CategoriesView />
                  </Layout>
                </RequireTenant>
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </TenantProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
