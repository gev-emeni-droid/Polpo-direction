import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PlanningView from './pages/PlanningView';
import InvoicePage from './pages/InvoicePage';
import { migrateLocalStorageToD1, initMockData, getTheme } from './services/storage';
import { applyTheme } from './services/theme';
import { api as invoiceApi } from './services/invoiceApi';

const updateFavicon = (logoUrl?: string) => {
  let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    document.head.appendChild(favicon);
  }

  if (logoUrl) {
    // If logo exists, use it as favicon
    favicon.href = logoUrl;
  } else {
    // Default L'IAMANI logo
    favicon.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 480"><rect width="768" height="480" fill="%23E8DCC8"/><text x="280" y="280" font-family="Arial, sans-serif" font-size="140" font-weight="bold" fill="%238B7566" letter-spacing="8">L\'IAMANI</text><circle cx="630" cy="280" r="110" fill="%23D4A5B8"/><text x="630" y="310" dominant-baseline="middle" text-anchor="middle" font-family="Georgia, serif" font-size="100" font-weight="bold" fill="%238B3A50">L</text></svg>';
};

const loadInvoiceLogoSettings = async () => {
  try {
    // Load settings from API (invoice settings)
    const settings = await invoiceApi.settings.get();
    if (settings && settings.logo) {
      updateFavicon(settings.logo);
      return;
    }
  } catch (err) {
    console.warn('Failed to load invoice settings for favicon:', err);
  }
  
  // If no logo found, use default
  updateFavicon();
};

const App: React.FC = () => {
  useEffect(() => {
    // Initialize mock data (API currently unavailable, using local fallback)
    const bootstrap = async () => {
      try {
        // Init Theme
        const themeColor = await getTheme();
        applyTheme(themeColor);
      } catch (e) {
        console.warn('Theme init failed', e);
      }

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

      try {
        // Load invoice logo and update favicon
        await loadInvoiceLogoSettings();
      } catch (err) {
        console.warn('Favicon init failed:', err);
      }
    };

    bootstrap();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/facture" element={<InvoicePage />} />
        <Route path="/planning/:id" element={<PlanningView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;