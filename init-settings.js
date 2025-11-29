// Script pour initialiser les paramètres par défaut
const API_URL = 'https://polpo-direction-api.gev-emeni.workers.dev';
const ORIGIN = 'https://05d5d318.polpo-direction.pages.dev';

// Paramètres par défaut
const defaultSettings = [
  {
    scope: 'global',
    key: 'ui_display',
    value_json: {
      show_labels: true,
      show_midi_soir_labels: true,
      show_coupure_labels: true,
      default_view: 'week', // 'day' or 'week'
      week_start_day: 1, // Monday
      time_format: '24h',
      date_format: 'DD/MM/YYYY'
    }
  },
  {
    scope: 'global',
    key: 'colors',
    value_json: {
      shift_codes: {
        AM: '#fbbf24',
        AA: '#34d399', 
        AMAA: '#60a5fa',
        CP: '#f87171',
        MAL: '#ef4444',
        RTT: '#fb923c',
        REPOS: '#9ca3af',
        FERIE: '#a78bfa'
      },
      roles: {
        'ENCADREMENT': '#dc2626',
        'COMMERCIALE + ADMIN': '#059669',
        'ACCUEIL': '#2563eb',
        'MANAGERS': '#7c3aed',
        'BARMAN': '#ea580c',
        'CHEF DE RANG': '#0891b2',
        'APPRENTI': '#65a30d',
        'RUNNER': '#ca8a04',
        'PLAGE / RUNNER': '#0d9488'
      }
    }
  },
  {
    scope: 'global',
    key: 'export_pdf',
    value_json: {
      include_hours: true,
      include_notes: true,
      include_absences: true,
      include_externals: true,
      include_weekend: false,
      role_columns: [], // Sera rempli dynamiquement avec les rôles de la DB
      date_range: {
        start: null,
        end: null
      },
      format: 'A4',
      orientation: 'portrait'
    }
  },
  {
    scope: 'global',
    key: 'planning_rules',
    value_json: {
      max_daily_hours: 8,
      max_weekly_hours: 35,
      required_break_minutes: 30,
      min_rest_hours: 11,
      auto_generate_segments: true,
      allow_overlap: false,
      require_role_for_shifts: false
    }
  },
  {
    scope: 'global',
    key: 'ui_preferences',
    value_json: {
      hidden_roles: [],
      default_filters: {
        show_active_only: true,
        show_externals: true,
        role_filter: 'all'
      },
      last_viewed_period: null,
      auto_save_interval: 30, // secondes
      confirm_before_delete: true
    }
  }
];

async function updateSetting(setting) {
  try {
    const response = await fetch(`${API_URL}/api/settings/${setting.scope}/${setting.key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      },
      body: JSON.stringify({
        value_json: setting.value_json
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Setting créé/mis à jour: ${setting.scope}.${setting.key}`);
      return result.success;
    } else {
      const errorData = await response.json();
      console.log(`❌ Erreur création ${setting.scope}.${setting.key}: ${errorData.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Erreur création ${setting.scope}.${setting.key}:`, error);
    return false;
  }
}

async function initSettings() {
  console.log('🚀 Initialisation des paramètres...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const setting of defaultSettings) {
    const success = await updateSetting(setting);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    // Petite pause pour éviter de surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Résultats de l\'initialisation:');
  console.log(`   ✅ Settings créés: ${successCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  console.log(`   📈 Total: ${defaultSettings.length} settings`);
  
  if (successCount > 0) {
    console.log('\n🎉 Initialisation terminée avec succès!');
    console.log('   Les paramètres sont maintenant disponibles dans la base de données D1.');
  }
  
  // Vérification finale
  console.log('\n🔍 Vérification des settings...');
  try {
    const response = await fetch(`${API_URL}/api/settings`, {
      headers: { 'Origin': ORIGIN }
    });
    const data = await response.json();
    console.log(`   📋 Settings en base: ${data.data.length}`);
    data.data.forEach(setting => {
      console.log(`      - ${setting.scope}.${setting.key}: ${Object.keys(setting.value_json).length} propriétés`);
    });
  } catch (error) {
    console.error('❌ Erreur vérification:', error);
  }
}

// Lancer l'initialisation
initSettings().catch(console.error);
