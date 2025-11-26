import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AccountView from './pages/AccountView';
import ReportsView from './pages/ReportsView';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/banking" element={<Dashboard />} />
          <Route path="/accounts/:id" element={<AccountView />} />
          <Route path="/reports" element={<ReportsView />} />
          {/* Add other routes later */}
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
