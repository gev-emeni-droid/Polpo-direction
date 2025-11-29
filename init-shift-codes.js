// Script pour initialiser les codes horaires de base
const API_URL = 'https://polpo-direction-api.gev-emeni.workers.dev';
const ORIGIN = 'https://05d5d318.polpo-direction.pages.dev';

// Codes horaires de base avec couleurs et heures par défaut
const shiftCodesData = [
  {
    code: 'AM',
    label: 'Matin',
    default_color: '#fbbf24', // Jaune
    default_start_midi: '09:00',
    default_end_midi: '12:00',
    default_start_soir: null,
    default_end_soir: null,
    is_absence: 0,
    is_rest: 0
  },
  {
    code: 'AA',
    label: 'Après-midi',
    default_color: '#34d399', // Vert
    default_start_midi: null,
    default_end_midi: null,
    default_start_soir: '14:00',
    default_end_soir: '18:00',
    is_absence: 0,
    is_rest: 0
  },
  {
    code: 'AMAA',
    label: 'Journée complète',
    default_color: '#60a5fa', // Bleu
    default_start_midi: '09:00',
    default_end_midi: '12:00',
    default_start_soir: '14:00',
    default_end_soir: '18:00',
    is_absence: 0,
    is_rest: 0
  },
  {
    code: 'CP',
    label: 'Congés Payés',
    default_color: '#f87171', // Rouge
    default_start_midi: null,
    default_end_midi: null,
    default_start_soir: null,
    default_end_soir: null,
    is_absence: 1,
    is_rest: 0
  },
  {
    code: 'MAL',
    label: 'Maladie',
    default_color: '#ef4444', // Rouge vif
    default_start_midi: null,
    default_end_midi: null,
    default_start_soir: null,
    default_end_soir: null,
    is_absence: 1,
    is_rest: 0
  },
  {
    code: 'RTT',
    label: 'RTT',
    default_color: '#fb923c', // Orange
    default_start_midi: null,
    default_end_midi: null,
    default_start_soir: null,
    default_end_soir: null,
    is_absence: 1,
    is_rest: 0
  },
  {
    code: 'REPOS',
    label: 'Repos',
    default_color: '#9ca3af', // Gris
    default_start_midi: null,
    default_end_midi: null,
    default_start_soir: null,
    default_end_soir: null,
    is_absence: 0,
    is_rest: 1
  },
  {
    code: 'FERIE',
    label: 'Férié',
    default_color: '#a78bfa', // Violet
    default_start_midi: null,
    default_end_midi: null,
    default_start_soir: null,
    default_end_soir: null,
    is_absence: 0,
    is_rest: 1
  }
];

async function createShiftCode(shiftCode) {
  try {
    const response = await fetch(`${API_URL}/api/shift-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      },
      body: JSON.stringify(shiftCode)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Code horaire créé: ${shiftCode.code} - ${shiftCode.label}`);
      return result.success;
    } else {
      const errorData = await response.json();
      if (errorData.message && errorData.message.includes('UNIQUE constraint failed')) {
        console.log(`ℹ️  Code horaire déjà existant: ${shiftCode.code} - ${shiftCode.label}`);
        return true; // C'est OK s'il existe déjà
      }
      console.log(`❌ Erreur création ${shiftCode.code}: ${errorData.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Erreur création ${shiftCode.code}:`, error);
    return false;
  }
}

async function initShiftCodes() {
  console.log('🚀 Initialisation des codes horaires...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const shiftCode of shiftCodesData) {
    const success = await createShiftCode(shiftCode);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    // Petite pause pour éviter de surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Résultats de l\'initialisation:');
  console.log(`   ✅ Codes créés: ${successCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  console.log(`   📈 Total: ${shiftCodesData.length} codes`);
  
  if (successCount > 0) {
    console.log('\n🎉 Initialisation terminée avec succès!');
    console.log('   Les codes horaires sont maintenant disponibles dans la base de données D1.');
  }
  
  // Vérification finale
  console.log('\n🔍 Vérification des codes horaires...');
  try {
    const response = await fetch(`${API_URL}/api/shift-codes`, {
      headers: { 'Origin': ORIGIN }
    });
    const data = await response.json();
    console.log(`   📋 Codes horaires en base: ${data.data.length}`);
    data.data.forEach(code => {
      console.log(`      - ${code.code}: ${code.label} (${code.is_absence ? 'Absence' : code.is_rest ? 'Repos' : 'Travail'})`);
    });
  } catch (error) {
    console.error('❌ Erreur vérification:', error);
  }
}

// Lancer l'initialisation
initShiftCodes().catch(console.error);
