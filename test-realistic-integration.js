// Test d'intégration réaliste avec des données existantes
console.log('🎯 TEST D\'INTÉGRATION RÉALISTE - Full-Stack D1 Persistence\n');

const API_URL = 'https://polpo-direction-api.gev-emeni.workers.dev';
const PAGES_URL = 'https://9d5f29dc.polpo-direction.pages.dev';
const ORIGIN = 'https://05d5d318.polpo-direction.pages.dev';

let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
  realData: {}
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
      if (data.data) {
        return data.data;
      }
    }
    
    return success;
  } catch (error) {
    testResults.tests.push(`❌ ${name}: FAILED - ${error.message}`);
    testResults.failed++;
    return false;
  }
}

async function runRealisticTests() {
  console.log('🚀 Lancement des tests réalistes...\n');
  
  // 1. Récupérer les données existantes
  console.log('1️⃣ Récupération des données existantes');
  testResults.realData.roles = await testEndpoint('GET Roles', '/api/roles');
  testResults.realData.employees = await testEndpoint('GET Employees', '/api/employees');
  testResults.realData.shiftCodes = await testEndpoint('GET Shift Codes', '/api/shift-codes');
  
  // 2. Tests des rôles avec des données réelles
  console.log('\n2️⃣ Tests des rôles (CRUD complet)');
  
  // Créer un rôle avec un slug unique
  const uniqueSlug = `test-role-${Date.now()}`;
  const testRoleData = {
    name: 'ROLE_TEST_INTEGRATION',
    slug: uniqueSlug,
    sort_order: 999,
    header_bg_color: '#ff0000',
    is_active: 1
  };
  const createdRole = await testEndpoint('POST Role', '/api/roles', 'POST', testRoleData, 200);
  
  if (createdRole) {
    // Mettre à jour le rôle
    const updateRoleData = { ...testRoleData, name: 'ROLE_TEST_UPDATED' };
    await testEndpoint('PUT Role', `/api/roles/${createdRole.id}`, 'PUT', updateRoleData);
    
    // Supprimer le rôle
    await testEndpoint('DELETE Role', `/api/roles/${createdRole.id}`, 'DELETE');
  }
  
  // 3. Tests des employés avec des données réelles
  console.log('\n3️⃣ Tests des employés (CRUD complet)');
  
  if (testResults.realData.employees && testResults.realData.employees.length > 0) {
    const firstEmployee = testResults.realData.employees[0];
    
    // Mettre à jour le premier employé
    const updateEmployeeData = {
      first_name: firstEmployee.first_name,
      last_name: firstEmployee.last_name,
      display_name: `${firstEmployee.first_name} ${firstEmployee.last_name} (Test)`,
      role_id: firstEmployee.role_id,
      status: 'active',
      is_external: firstEmployee.is_external || 0,
      email: firstEmployee.email,
      phone: firstEmployee.phone
    };
    await testEndpoint('PUT Employee', `/api/employees/${firstEmployee.id}`, 'PUT', updateEmployeeData);
  }
  
  // 4. Tests des codes horaires
  console.log('\n4️⃣ Tests des codes horaires');
  
  // Créer un code horaire test
  const testShiftCodeData = {
    code: `TEST${Date.now()}`,
    label: 'Test Code Integration',
    default_color: '#00ff00',
    default_start_midi: '09:00',
    default_end_midi: '12:00',
    default_start_soir: '14:00',
    default_end_soir: '18:00',
    is_absence: 0,
    is_rest: 0
  };
  const createdShiftCode = await testEndpoint('POST Shift Code', '/api/shift-codes', 'POST', testShiftCodeData, 200);
  
  if (createdShiftCode) {
    // Mettre à jour le code horaire
    await testEndpoint('PUT Shift Code', `/api/shift-codes/${createdShiftCode.code}`, 'PUT', { ...testShiftCodeData, label: 'Test Code Updated' });
    
    // Supprimer le code horaire
    await testEndpoint('DELETE Shift Code', `/api/shift-codes/${createdShiftCode.code}`, 'DELETE');
  }
  
  // 5. Tests des shifts (planning) avec des données réelles
  console.log('\n5️⃣ Tests des shifts (planning)');
  
  if (testResults.realData.employees && testResults.realData.employees.length > 0 && testResults.realData.shiftCodes && testResults.realData.shiftCodes.length > 0) {
    const firstEmployee = testResults.realData.employees[0];
    const firstShiftCode = testResults.realData.shiftCodes.find(sc => !sc.is_absence && !sc.is_rest) || testResults.realData.shiftCodes[0];
    
    // Créer un shift test
    const testShiftData = {
      employee_id: firstEmployee.id,
      date: '2025-01-01',
      role_id: firstEmployee.role_id,
      notes: 'Test shift integration',
      segments: [
        {
          segment: 'midi',
          code: firstShiftCode.code,
          start_time: firstShiftCode.default_start_midi || '09:00',
          end_time: firstShiftCode.default_end_midi || '12:00'
        }
      ]
    };
    const createdShift = await testEndpoint('POST Shift', '/api/shifts', 'POST', testShiftData, 200);
    
    if (createdShift) {
      // Supprimer le shift
      await testEndpoint('DELETE Shift', `/api/shifts/${createdShift.id}`, 'DELETE');
    }
  }
  
  // 6. Tests des absences avec des données réelles
  console.log('\n6️⃣ Tests des absences');
  
  if (testResults.realData.employees && testResults.realData.employees.length > 0 && testResults.realData.shiftCodes && testResults.realData.shiftCodes.length > 0) {
    const firstEmployee = testResults.realData.employees[0];
    const absenceCode = testResults.realData.shiftCodes.find(sc => sc.is_absence) || testResults.realData.shiftCodes[0];
    
    // Créer une absence test
    const testAbsenceData = {
      employee_id: firstEmployee.id,
      start_date: '2025-01-01',
      end_date: '2025-01-03',
      code: absenceCode.code,
      notes: 'Test absence integration'
    };
    const createdAbsence = await testEndpoint('POST Absence', '/api/absences', 'POST', testAbsenceData, 200);
    
    if (createdAbsence) {
      // Supprimer l'absence
      await testEndpoint('DELETE Absence', `/api/absences/${createdAbsence.id}`, 'DELETE');
    }
  }
  
  // 7. Tests des settings
  console.log('\n7️⃣ Tests des settings');
  await testEndpoint('GET Settings', '/api/settings');
  
  // Créer/mettre à jour un setting
  const testSettingData = {
    value_json: {
      test_key: 'test_value',
      timestamp: new Date().toISOString(),
      integration_test: true
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
  
  console.log('\n📊 DONNÉES RÉELLES UTILISÉES:');
  console.log(`   🎭 Rôles: ${testResults.realData.roles?.length || 0}`);
  console.log(`   👥 Employés: ${testResults.realData.employees?.length || 0}`);
  console.log(`   ⏰ Codes horaires: ${testResults.realData.shiftCodes?.length || 0}`);
  
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
runRealisticTests().catch(console.error);
