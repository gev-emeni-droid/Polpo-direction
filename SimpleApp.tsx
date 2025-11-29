import React from 'react';

console.log('🚀 Simple App component loading...');

const SimpleApp: React.FC = () => {
  console.log('🎨 SimpleApp rendering...');
  
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Polpo Planning - Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Statut de l'application</h2>
          <div className="space-y-2">
            <p className="text-green-600">✅ React fonctionne</p>
            <p className="text-green-600">✅ Tailwind CSS fonctionne</p>
            <p className="text-green-600">✅ Composant chargé</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test des fonctionnalités</h2>
          <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-4">
            Bouton test
          </button>
          <input 
            type="text" 
            placeholder="Champ de test" 
            className="border rounded px-3 py-2"
          />
        </div>
      </div>
    </div>
  );
};

export default SimpleApp;
