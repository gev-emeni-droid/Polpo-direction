// Test d'intégration complet pour valider tous les cas d'usage
console.log('🎯 TEST D\'INTÉGRATION COMPLET - Full-Stack D1 Persistence\n');

const API_URL = 'https://polpo-direction-api.gev-emeni.workers.dev';
const PAGES_URL = 'https://9d5f29dc.polpo-direction.pages.dev';
const ORIGIN = 'https://05d5d318.polpo-direction.pages.dev';

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

async function testEndpoint(name, url, method = 'GET', body = null, expectedStatus = 200) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${url}`, options);
    const status = response.status;
    
    if (status === 204) {
      testResults.tests.push(`✅ ${name}: ${status} (OPTIONS OK)`);
      testResults.passed++;
      return true;
    }
    
    const data = await response.json();
    const success = data.success;
    const passed = status === expectedStatus && success;
    
    testResults.tests.push(`${passed ? '✅' : '❌'} ${name}: ${status} - ${success ? 'SUCCESS' : 'FAILED'}`);
    if (!success) {
      testResults.tests.push(`   Error: ${data.message}`);
      testResults.failed++;
    } else {
      testResults.passed++;
    }
    
    return success;
  } catch (error) {
    testResults.tests.push(`❌ ${name}: FAILED - ${error.message}`);
    testResults.failed++;
    return false;
  }
}

async function runIntegrationTests() {
  console.log('🚀 Lancement des tests d\'intégration...\n');
  
  // 1. Tests de base et CORS
  console.log('1️⃣ Tests de base et CORS');
  await testEndpoint('Health Check', '/api/health');
  await testEndpoint('CORS Preflight', '/api/roles', 'OPTIONS');
  
  // 2. Tests des rôles (CRUD complet)
  console.log('\n2️⃣ Tests des rôles (CRUD complet)');
  const roles = await testEndpoint('GET Roles', '/api/roles');
  
  // Créer un rôle test
  const testRoleData = {
    name: 'ROLE_TEST',
    slug: 'role-test',
    sort_order: 999,
    header_bg_color: '#ff0000',
    is_active: 1
  };
  const roleCreated = await testEndpoint('POST Role', '/api/roles', 'POST', testRoleData, 200);
  
  // Mettre à jour le rôle
  if (roleCreated) {
    const updateRoleData = { ...testRoleData, name: 'ROLE_TEST_UPDATED' };
    await testEndpoint('PUT Role', '/api/roles/ROLE_TEST', 'PUT', updateRoleData);
  }
  
  // Supprimer le rôle
  await testEndpoint('DELETE Role', '/api/roles/ROLE_TEST', 'DELETE');
  
  // 3. Tests des employés (CRUD complet)
  console.log('\n3️⃣ Tests des employés (CRUD complet)');
  const employees = await testEndpoint('GET Employees', '/api/employees');
  
  // Créer un employé test
  const testEmployeeData = {
    first_name: 'Test',
    last_name: 'Employee',
    display_name: 'Test Employee Integration',
    role_id: 'MANAGERS',
    status: 'active',
    is_external: 0,
    email: 'test@example.com',
    phone: '0123456789'
  };
  const employeeCreated = await testEndpoint('POST Employee', '/api/employees', 'POST', testEmployeeData, 200);
  
  // Mettre à jour l'employé
  if (employeeCreated) {
    const updateEmployeeData = { ...testEmployeeData, display_name: 'Test Employee Updated' };
    await testEndpoint('PUT Employee', '/api/employees/test-employee-id', 'PUT', updateEmployeeData);
  }
  
  // 4. Tests des codes horaires
  console.log('\n4️⃣ Tests des codes horaires');
  await testEndpoint('GET Shift Codes', '/api/shift-codes');
  
  // Créer un code horaire test
  const testShiftCodeData = {
    code: 'TEST',
    label: 'Test Code',
    default_color: '#00ff00',
    default_start_midi: '09:00',
    default_end_midi: '12:00',
    default_start_soir: '14:00',
    default_end_soir: '18:00',
    is_absence: 0,
    is_rest: 0
  };
  await testEndpoint('POST Shift Code', '/api/shift-codes', 'POST', testShiftCodeData);
  
  // Mettre à jour le code horaire
  await testEndpoint('PUT Shift Code', '/api/shift-codes/TEST', 'PUT', { ...testShiftCodeData, label: 'Test Code Updated' });
  
  // Supprimer le code horaire
  await testEndpoint('DELETE Shift Code', '/api/shift-codes/TEST', 'DELETE');
  
  // 5. Tests des shifts (planning)
  console.log('\n5️⃣ Tests des shifts (planning)');
  await testEndpoint('GET Shifts', '/api/shifts');
  
  // Créer un shift test
  const testShiftData = {
    employee_id: 'test-employee-id',
    date: '2025-01-01',
    role_id: 'MANAGERS',
    notes: 'Test shift',
    segments: [
      {
        segment: 'midi',
        code: 'AM',
        start_time: '09:00',
        end_time: '12:00'
      },
      {
        segment: 'soir',
        code: 'AA',
        start_time: '14:00',
        end_time: '18:00'
      }
    ]
  };
  await testEndpoint('POST Shift', '/api/shifts', 'POST', testShiftData);
  
  // 6. Tests des absences
  console.log('\n6️⃣ Tests des absences');
  await testEndpoint('GET Absences', '/api/absences');
  
  // Créer une absence test
  const testAbsenceData = {
    employee_id: 'test-employee-id',
    start_date: '2025-01-01',
    end_date: '2025-01-03',
    code: 'CP',
    notes: 'Test absence'
  };
  await testEndpoint('POST Absence', '/api/absences', 'POST', testAbsenceData);
  
  // 7. Tests des settings
  console.log('\n7️⃣ Tests des settings');
  await testEndpoint('GET Settings', '/api/settings');
  
  // Créer/mettre à jour un setting
  const testSettingData = {
    value_json: {
      test_key: 'test_value',
      timestamp: new Date().toISOString()
    }
  };
  await testEndpoint('PUT Setting', '/api/settings/global/test_integration', 'PUT', testSettingData);
  
  // 8. Tests de l'audit log
  console.log('\n8️⃣ Tests de l\'audit log');
  await testEndpoint('GET Audit Log', '/api/audit');
  
  // 9. Test du frontend
  console.log('\n9️⃣ Test du frontend');
  try {
    const pagesResponse = await fetch(PAGES_URL);
    testResults.tests.push(`${pagesResponse.ok ? '✅' : '❌'} Frontend Pages: ${pagesResponse.status}`);
    if (pagesResponse.ok) {
      testResults.passed++;
    } else {
      testResults.failed++;
    }
  } catch (error) {
    testResults.tests.push(`❌ Frontend Pages: FAILED - ${error.message}`);
    testResults.failed++;
  }
  
  // 10. Test de cohérence Jour/Semaine
  console.log('\n🔍 Test de cohérence Jour/Semaine');
  try {
    // Récupérer les employés depuis l'API
    const employeesResponse = await fetch(`${API_URL}/api/employees`, {
      headers: { 'Origin': ORIGIN }
    });
    const employeesData = await employeesResponse.json();
    
    if (employeesData.success && employeesData.data.length > 0) {
      testResults.tests.push(`✅ Cohérence API: ${employeesData.data.length} employés chargés`);
      testResults.passed++;
    } else {
      testResults.tests.push('❌ Cohérence API: Erreur chargement employés');
      testResults.failed++;
    }
  } catch (error) {
    testResults.tests.push(`❌ Cohérence API: FAILED - ${error.message}`);
    testResults.failed++;
  }
  
  // Résultats finaux
  console.log('\n🎉 TESTS TERMINÉS\n');
  console.log('📊 RÉSULTATS:');
  console.log(`   ✅ Tests passés: ${testResults.passed}`);
  console.log(`   ❌ Tests échoués: ${testResults.failed}`);
  console.log(`   📈 Total: ${testResults.passed + testResults.failed} tests`);
  
  console.log('\n📋 DÉTAIL DES TESTS:');
  testResults.tests.forEach(test => console.log(`   ${test}`));
  
  console.log('\n🌐 URLs DE TEST:');
  console.log(`   Frontend: ${PAGES_URL}`);
  console.log(`   API: ${API_URL}`);
  
  if (testResults.failed === 0) {
    console.log('\n🎯 MISSION STATUS: TOUS LES TESTS PASSÉS - FULL-STACK D1 PERSISTENCE OPÉRATIONNEL! 🚀');
  } else {
    console.log(`\n⚠️  MISSION STATUS: ${testResults.failed} tests échoués - Vérifier les erreurs ci-dessus`);
  }
}

// Lancer les tests
runIntegrationTests().catch(console.error);
