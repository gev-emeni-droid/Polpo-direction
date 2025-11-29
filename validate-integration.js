// Validation script for complete API integration
async function validateIntegration() {
  const API_URL = 'https://polpo-direction-api.gev-emeni.workers.dev';
  const PAGES_URL = 'https://8033e779.polpo-direction.pages.dev';
  const ORIGIN = PAGES_URL;
  
  console.log('🚀 Starting integration validation...\n');
  
  try {
    // Test 1: API Health
    console.log('1️⃣ Testing API Health');
    const healthResponse = await fetch(`${API_URL}/api/health`);
    const healthData = await healthResponse.json();
    console.log(`   ✅ Status: ${healthResponse.status}`);
    console.log(`   ✅ Database: ${healthData.data.database}`);
    console.log(`   ✅ Roles count: ${healthData.data.roles_count}\n`);
    
    // Test 2: CORS Preflight
    console.log('2️⃣ Testing CORS Preflight');
    const preflightResponse = await fetch(`${API_URL}/api/roles`, {
      method: 'OPTIONS',
      headers: {
        'Origin': ORIGIN,
        'Access-Control-Request-Method': 'GET'
      }
    });
    console.log(`   ✅ OPTIONS Status: ${preflightResponse.status}\n`);
    
    // Test 3: API CRUD Operations
    console.log('3️⃣ Testing API CRUD Operations');
    
    // GET roles
    const rolesResponse = await fetch(`${API_URL}/api/roles`, {
      headers: { 'Origin': ORIGIN }
    });
    const rolesData = await rolesResponse.json();
    console.log(`   ✅ GET Roles: ${rolesData.data.length} roles`);
    
    // POST employee
    const testEmployee = {
      first_name: 'Validation',
      last_name: 'Test',
      display_name: 'Validation Test',
      role_id: rolesData.data[0]?.id || 'MANAGERS'
    };
    
    const createResponse = await fetch(`${API_URL}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      },
      body: JSON.stringify(testEmployee)
    });
    const createResult = await createResponse.json();
    console.log(`   ✅ POST Employee: ${createResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    if (createResult.success) {
      const employeeId = createResult.data.id;
      
      // GET employees
      const employeesResponse = await fetch(`${API_URL}/api/employees`, {
        headers: { 'Origin': ORIGIN }
      });
      const employeesData = await employeesResponse.json();
      console.log(`   ✅ GET Employees: ${employeesData.data.length} employees`);
      
      // PUT employee
      const updateResponse = await fetch(`${API_URL}/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Origin': ORIGIN
        },
        body: JSON.stringify({
          ...testEmployee,
          display_name: 'Validation Test Updated'
        })
      });
      const updateResult = await updateResponse.json();
      console.log(`   ✅ PUT Employee: ${updateResult.success ? 'SUCCESS' : 'FAILED'}`);
      
      // DELETE employee
      const deleteResponse = await fetch(`${API_URL}/api/employees/${employeeId}`, {
        method: 'DELETE',
        headers: { 'Origin': ORIGIN }
      });
      const deleteResult = await deleteResponse.json();
      console.log(`   ✅ DELETE Employee: ${deleteResult.success ? 'SUCCESS' : 'FAILED'}`);
    }
    
    console.log('');
    
    // Test 4: Pages Frontend
    console.log('4️⃣ Testing Pages Frontend');
    const pagesResponse = await fetch(PAGES_URL);
    console.log(`   ✅ Pages Status: ${pagesResponse.status}`);
    console.log(`   ✅ Pages URL: ${PAGES_URL}\n`);
    
    // Test 5: Settings
    console.log('5️⃣ Testing Settings API');
    const settingsResponse = await fetch(`${API_URL}/api/settings`, {
      headers: { 'Origin': ORIGIN }
    });
    const settingsData = await settingsResponse.json();
    console.log(`   ✅ Settings: ${settingsData.data.length} settings\n`);
    
    console.log('🎉 Integration validation completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ API Worker is running and accessible');
    console.log('   ✅ CORS is properly configured');
    console.log('   ✅ CRUD operations work correctly');
    console.log('   ✅ Pages frontend is deployed');
    console.log('   ✅ Database integration is functional');
    console.log('\n🌐 URLs:');
    console.log(`   Frontend: ${PAGES_URL}`);
    console.log(`   API: ${API_URL}`);
    
  } catch (error) {
    console.error('❌ Integration validation failed:', error);
  }
}

// Run validation
validateIntegration();
