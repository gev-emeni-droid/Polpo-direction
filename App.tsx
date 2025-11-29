import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PlanningView from './pages/PlanningView';
import { initMockData } from './services/storage';

console.log('🏗️ App component initializing...');

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔄 App useEffect started');
    
    const initializeApp = async () => {
      try {
        console.log('📊 Initializing mock data...');
        await initMockData();
        console.log('✅ Mock data initialized successfully');
        setIsInitialized(true);
      } catch (error) {
        console.error('❌ Failed to initialize app:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
        setIsInitialized(true); // Still show the app even if init fails
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    console.log('⏳ App still initializing...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'application...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    console.log('⚠️ App initialized with error:', initError);
  }

  console.log('🎯 App rendering router...');
  
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