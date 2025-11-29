import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

console.log('🚀 Starting application with debug mode...');

// Check if debug mode is enabled via URL parameter
const urlParams = new URLSearchParams(window.location.search);
const isDebugMode = urlParams.get('debug') === 'true';

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("❌ Could not find root element to mount to");
  document.body.innerHTML = '<div class="p-8 text-red-600">❌ Root element not found</div>';
  throw new Error("Could not find root element to mount to");
}

console.log('✅ Root element found, creating React root...');

const root = ReactDOM.createRoot(rootElement);

try {
  if (isDebugMode) {
    console.log('🔍 Debug mode activated');
    import('./DebugApp').then(({ default: DebugApp }) => {
      root.render(<DebugApp />);
    });
  } else {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log('✅ Application rendered successfully');
  }
} catch (error) {
  console.error('❌ Failed to render application:', error);
  
  rootElement.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-slate-50">
      <div class="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-xl font-bold text-red-600 mb-4">Erreur de démarrage</h2>
        <p class="text-gray-600 mb-4">
          L'application n'a pas pu démarrer correctement.
        </p>
        <pre class="text-xs bg-gray-100 p-2 rounded mb-4">${error}</pre>
        <div class="space-y-2">
          <button onclick="window.location.reload()" class="w-full bg-blue-500 text-white px-4 py-2 rounded">
            Réessayer
          </button>
          <a href="?debug=true" class="block w-full bg-orange-500 text-white px-4 py-2 rounded text-center">
            📊 Mode Debug
          </a>
        </div>
      </div>
    </div>
  `;
}