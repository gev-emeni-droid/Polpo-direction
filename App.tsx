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
    favicon.type = 'image/png';
    document.head.appendChild(favicon);
  }

  if (logoUrl) {
    // If logo exists, use it as favicon
    favicon.href = logoUrl;
  } else {
    // Otherwise, use default L'IAmani logo
    favicon.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%234AA3A2"/><circle cx="50" cy="50" r="35" fill="white" opacity="0.1"/><text x="50" y="58" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white">L</text><text x="50" y="28" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="white" letter-spacing="1">AMANI</text></svg>';
  }
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