// Script pour importer les employés existants dans la base de données D1
const API_URL = 'https://polpo-direction-api.gev-emeni.workers.dev';
const ORIGIN = 'https://05d5d318.polpo-direction.pages.dev';

// Données des employés extraites du code existant
const employeesData = [
  { role: 'ENCADREMENT', name: 'LOUISET FRANCOIS' },
  { role: 'ENCADREMENT', name: 'SENG PHILIPPE' },
  { role: 'ENCADREMENT', name: 'MINGUI REGIS' },
  { role: 'ENCADREMENT', name: 'LEBIHAN MATTHEU' },
  { role: 'ENCADREMENT', name: 'MANGANE LUCAS' },
  { role: 'COMMERCIALE + ADMIN', name: 'GLOUX JULIETTE' },
  { role: 'COMMERCIALE + ADMIN', name: 'MINIAOUI MAELLE' },
  { role: 'COMMERCIALE + ADMIN', name: 'MBOCK HANG JULIENNE' },
  { role: 'ACCUEIL', name: 'HESLOT EMENI' },
  { role: 'ACCUEIL', name: 'DRIDI SARAH' },
  { role: 'ACCUEIL', name: 'KROTN SHEILHANE' },
  { role: 'MANAGERS', name: 'GUILLOTTE NICOLAS' },
  { role: 'BARMAN', name: 'BARUA JEWEL' },
  { role: 'BARMAN', name: 'BARUA SWAJAN' },
  { role: 'BARMAN', name: 'DAS SRI POLAS' },
  { role: 'BARMAN', name: 'MANGEON MATHEO' },
  { role: 'CHEF DE RANG', name: 'POLLET SAMANTHA' },
  { role: 'CHEF DE RANG', name: 'MAGASSA MODY' },
  { role: 'CHEF DE RANG', name: 'BARUA SAGAR' },
  { role: 'CHEF DE RANG', name: 'BARUA SHUVA' },
  { role: 'CHEF DE RANG', name: 'KONATE IBRAHIMA' },
  { role: 'CHEF DE RANG', name: 'NDRI ABRAHAM' },
  { role: 'CHEF DE RANG', name: 'TAJUDDIN HASIM' },
  { role: 'CHEF DE RANG', name: 'LIN CHLOE' },
  { role: 'CHEF DE RANG', name: 'LAMINE MOHAMED' },
  { role: 'CHEF DE RANG', name: 'PENIN MAGALI' },
  { role: 'APPRENTI', name: 'SAADA RANDY' },
  { role: 'RUNNER', name: 'BARUA ROPAN RONY' },
  { role: 'RUNNER', name: 'SACKO DJABE' },
  { role: 'RUNNER', name: 'BARUA SAJU' },
  { role: 'RUNNER', name: 'BARUA BADAN' },
  { role: 'RUNNER', name: 'BARUA HRIDAY' },
  { role: 'RUNNER', name: 'KANTE DAOUBA' },
  { role: 'RUNNER', name: 'BARUA EMON (2)' },
  { role: 'RUNNER', name: 'BARUA EMON (1)' },
  { role: 'RUNNER', name: 'LE PICARD GAEL' },
  { role: 'RUNNER', name: 'DIDIORTAS YAROSLAV' },
  { role: 'PLAGE / RUNNER', name: 'IHOR IHNATENKO' },
];

async function getRoles() {
  try {
    const response = await fetch(`${API_URL}/api/roles`, {
      headers: { 'Origin': ORIGIN }
    });
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des rôles:', error);
    return [];
  }
}

async function createEmployee(employeeData, rolesMap) {
  try {
    const nameParts = employeeData.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const employeePayload = {
      first_name: firstName,
      last_name: lastName,
      display_name: employeeData.name,
      role_id: rolesMap[employeeData.role] || null,
      status: 'active',
      is_external: 0,
      external_category: null,
      contract_hours_week: null,
      contract_type: null,
      email: null,
      phone: null
    };

    const response = await fetch(`${API_URL}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      },
      body: JSON.stringify(employeePayload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Employé créé: ${employeeData.name}`);
      return result.success;
    } else {
      const errorData = await response.json();
      console.log(`❌ Erreur création ${employeeData.name}: ${errorData.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Erreur création ${employeeData.name}:`, error);
    return false;
  }
}

async function importEmployees() {
  console.log('🚀 Début de l\'importation des employés...\n');
  
  // 1. Récupérer les rôles existants
  console.log('1️⃣ Récupération des rôles...');
  const roles = await getRoles();
  const rolesMap = {};
  
  roles.forEach(role => {
    rolesMap[role.name] = role.id;
  });
  
  console.log(`   ✅ ${roles.length} rôles trouvés`);
  console.log('   📋 Rôles disponibles:', Object.keys(rolesMap).join(', '));
  
  // 2. Importer les employés
  console.log('\n2️⃣ Importation des employés...');
  let successCount = 0;
  let errorCount = 0;
  
  for (const employeeData of employeesData) {
    const success = await createEmployee(employeeData, rolesMap);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    // Petite pause pour éviter de surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Résultats de l\'importation:');
  console.log(`   ✅ Employés créés: ${successCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  console.log(`   📈 Total: ${employeesData.length} employés`);
  
  if (successCount > 0) {
    console.log('\n🎉 Importation terminée avec succès!');
    console.log('   Les employés sont maintenant disponibles dans la base de données D1.');
  } else {
    console.log('\n❌ Aucun employé n\'a pu être importé.');
  }
}

// Lancer l'importation
importEmployees().catch(console.error);
