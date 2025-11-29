import React, { useState, useEffect } from 'react';
import { getEmployees, getRoles, getShiftCodes } from './services/storage';

console.log('🚀 Debug App component loading...');

const DebugApp: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [shiftCodes, setShiftCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      console.log('🔄 Debug: Starting data load...');
      try {
        // Test localStorage first
        console.log('💾 Debug: Checking localStorage...');
        const localEmployees = localStorage.getItem('polpo_employees');
        const localRoles = localStorage.getItem('polpo_roles');
        const localShiftCodes = localStorage.getItem('polpo_shift_codes');
        
        console.log('📊 Debug: LocalStorage data found:', {
          employees: localEmployees ? 'Yes' : 'No',
          roles: localRoles ? 'Yes' : 'No',
          shiftCodes: localShiftCodes ? 'Yes' : 'No'
        });

        // Try API calls
        console.log('🌐 Debug: Trying API calls...');
        const [employeesData, rolesData, shiftCodesData] = await Promise.all([
          getEmployees().catch(e => {
            console.error('❌ Debug: Employees API failed:', e);
            return [];
          }),
          getRoles().catch(e => {
            console.error('❌ Debug: Roles API failed:', e);
            return [];
          }),
          getShiftCodes().catch(e => {
            console.error('❌ Debug: ShiftCodes API failed:', e);
            return [];
          })
        ]);

        console.log('✅ Debug: API results:', {
          employeesCount: employeesData.length,
          rolesCount: rolesData.length,
          shiftCodesCount: shiftCodesData.length
        });

        setEmployees(employeesData);
        setRoles(rolesData);
        setShiftCodes(shiftCodesData);
        
      } catch (err) {
        console.error('❌ Debug: Critical error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-8">Debug Mode</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-blue-600">🔄 Chargement des données...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-8">Debug Mode - Erreur</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-600 mb-4">Erreur critique</h2>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">🔍 Debug Mode - Données</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-blue-600 mb-4">Employés ({employees.length})</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {employees.length === 0 ? (
                <p className="text-gray-500">Aucun employé trouvé</p>
              ) : (
                employees.map(emp => (
                  <div key={emp.id} className="text-sm p-2 bg-gray-50 rounded">
                    <strong>{emp.name}</strong> - {emp.role}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-green-600 mb-4">Rôles ({roles.length})</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {roles.length === 0 ? (
                <p className="text-gray-500">Aucun rôle trouvé</p>
              ) : (
                roles.map(role => (
                  <div key={role.id} className="text-sm p-2 bg-gray-50 rounded">
                    <strong>{role.label}</strong> ({role.id})
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-purple-600 mb-4">Codes de service ({shiftCodes.length})</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {shiftCodes.length === 0 ? (
                <p className="text-gray-500">Aucun code trouvé</p>
              ) : (
                shiftCodes.map(code => (
                  <div key={code.code} className="text-sm p-2 bg-gray-50 rounded">
                    <strong>{code.code}</strong> - {code.label}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-orange-600 mb-4">Actions</h2>
          <div className="space-y-4">
            <button 
              onClick={() => window.location.href = '/'}
              className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 mr-4"
            >
              🏠 Retour à l'application
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 mr-4"
            >
              🔄 Recharger les données
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="bg-red-500 text-white px-6 py-3 rounded hover:bg-red-600"
            >
              🗑️ Vider le cache
            </button>
          </div>
        </div>

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-4">🔧 Résolution des problèmes</h2>
          <div className="text-sm text-yellow-700 space-y-2">
            <p>• Si vous voyez 0 employés/rôles/codes : Votre API a des problèmes CORS</p>
            <p>• Si les données s'affichent : L'API fonctionne, le problème est ailleurs</p>
            <p>• Ouvrez la console (F12) pour voir les erreurs détaillées</p>
            <p>• Votre API doit envoyer : <code>Access-Control-Allow-Origin: *</code></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugApp;
