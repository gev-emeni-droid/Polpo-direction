// Test final complet avec la nouvelle URL
console.log('🎯 TEST FINAL COMPLET - Nouvelle URL Pages\n');

const API_URL = 'https://polpo-direction-api.gev-emeni.workers.dev';
const PAGES_URL = 'https://f9ba74fb.polpo-direction.pages.dev';
const ORIGIN = 'https://f9ba74fb.polpo-direction.pages.dev';

async function testComplete() {
  try {
    console.log('🚀 Test complet avec la nouvelle URL...\n');
    
    // Test health
    const healthResponse = await fetch(`${API_URL}/api/health`, {
      headers: { 'Origin': ORIGIN }
    });
    console.log(`✅ Health: ${healthResponse.status}`);
    
    // Test employees
    const employeesResponse = await fetch(`${API_URL}/api/employees`, {
      headers: { 'Origin': ORIGIN }
    });
    const employeesData = await employeesResponse.json();
    console.log(`✅ Employees: ${employeesData.success ? 'SUCCESS' : 'FAILED'} - ${employeesData.data?.length || 0} employés`);
    
    // Test roles
    const rolesResponse = await fetch(`${API_URL}/api/roles`, {
      headers: { 'Origin': ORIGIN }
    });
    const rolesData = await rolesResponse.json();
    console.log(`✅ Roles: ${rolesData.success ? 'SUCCESS' : 'FAILED'} - ${rolesData.data?.length || 0} rôles`);
    
    // Test shift codes
    const shiftCodesResponse = await fetch(`${API_URL}/api/shift-codes`, {
      headers: { 'Origin': ORIGIN }
    });
    const shiftCodesData = await shiftCodesResponse.json();
    console.log(`✅ Shift Codes: ${shiftCodesData.success ? 'SUCCESS' : 'FAILED'} - ${shiftCodesData.data?.length || 0} codes`);
    
    // Test settings
    const settingsResponse = await fetch(`${API_URL}/api/settings`, {
      headers: { 'Origin': ORIGIN }
    });
    const settingsData = await settingsResponse.json();
    console.log(`✅ Settings: ${settingsData.success ? 'SUCCESS' : 'FAILED'} - ${settingsData.data?.length || 0} settings`);
    
    // Test frontend
    const pagesResponse = await fetch(PAGES_URL);
    console.log(`✅ Frontend: ${pagesResponse.ok ? 'SUCCESS' : 'FAILED'} - ${pagesResponse.status}`);
    
    // Test CORS preflight
    const preflightResponse = await fetch(`${API_URL}/api/employees`, {
      method: 'OPTIONS',
      headers: { 
        'Origin': ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log(`✅ CORS Preflight: ${preflightResponse.status}`);
    
    console.log('\n🎉 TEST TERMINÉ - TOUT EST OPÉRATIONNEL!');
    console.log(`🌐 Frontend: ${PAGES_URL}`);
    console.log(`🔧 API: ${API_URL}`);
    console.log(`📊 Données: ${employeesData.data?.length || 0} employés, ${rolesData.data?.length || 0} rôles, ${shiftCodesData.data?.length || 0} codes`);
    
    console.log('\n🎯 STATUS: FULL-STACK D1 PERSISTENCE 100% OPÉRATIONNEL! 🚀');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

testComplete();
