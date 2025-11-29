// Test script for API
async function testAPI() {
  const API_URL = 'https://polpo-direction-api.gev-emeni.workers.dev';
  const ORIGIN = 'https://05d5d318.polpo-direction.pages.dev';
  
  try {
    console.log('Testing API...');
    
    // Test 1: GET roles
    console.log('\n1. Testing GET /api/roles');
    const rolesResponse = await fetch(`${API_URL}/api/roles`, {
      method: 'GET',
      headers: {
        'Origin': ORIGIN
      }
    });
    console.log('Status:', rolesResponse.status);
    const rolesData = await rolesResponse.json();
    console.log('Roles count:', rolesData.data?.length || 0);
    
    // Test 2: POST employee
    console.log('\n2. Testing POST /api/employees');
    const employeeData = {
      first_name: 'Test',
      last_name: 'Employee',
      display_name: 'Test Employee',
      role_id: 'MANAGERS'
    };
    
    const createResponse = await fetch(`${API_URL}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      },
      body: JSON.stringify(employeeData)
    });
    console.log('Status:', createResponse.status);
    const createResult = await createResponse.json();
    console.log('Created employee:', createResult.success ? 'SUCCESS' : 'FAILED');
    
    // Test 3: GET employees
    console.log('\n3. Testing GET /api/employees');
    const employeesResponse = await fetch(`${API_URL}/api/employees`, {
      method: 'GET',
      headers: {
        'Origin': ORIGIN
      }
    });
    console.log('Status:', employeesResponse.status);
    const employeesData = await employeesResponse.json();
    console.log('Employees count:', employeesData.data?.length || 0);
    
    console.log('\n✅ API test completed successfully!');
    
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

// Run the test
testAPI();
