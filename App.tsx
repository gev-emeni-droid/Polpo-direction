import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PlanningView from './pages/PlanningView';
import { migrateLocalStorageToD1, initMockData } from './services/storage';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize mock data (API currently unavailable, using local fallback)
    const bootstrap = async () => {
      try {
        // Skip migration for now - API not deployed
        // await migrateLocalStorageToD1();
      } catch (err) {
        console.warn('Migration skipped - API unavailable');
      }
      
      try {
        // Initialize mock data
        await initMockData();
      } catch (err) {
        console.error('Mock data init failed:', err);
      }
    };

    bootstrap();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/planning/:id" element={<PlanningView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;