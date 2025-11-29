import { Employee, Planning, Template, STANDARD_ROLES, ShiftServiceType, ShiftSegment } from '../types';
import { addDays, format, parseISO, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { API_BASE_URL } from '../src/config';

// Helper functions for API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'API operation failed');
    }
    
    return data.data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

// ===== ROLES =====
export const getRoles = async (): Promise<{id: string, label: string, header_bg_color?: string, sort_order?: number, is_active?: boolean}[]> => {
  try {
    const roles = await apiCall('/api/roles');
    // S'assurer que c'est bien un tableau
    if (!Array.isArray(roles)) {
      console.warn('API returned non-array for roles, using empty array');
      return [];
    }
    return roles.map((r: any) => ({
      id: r.id,
      label: r.name,
      header_bg_color: r.header_bg_color,
      sort_order: r.sort_order,
      is_active: r.is_active,
      slug: r.slug
    }));
  } catch (e) {
    console.warn('API failed, using localStorage fallback for roles');
    const fallbackRoles = localStorage.getItem('polpo_roles');
    return fallbackRoles ? JSON.parse(fallbackRoles) : STANDARD_ROLES.filter(r => r !== 'GÉNÉRAL').map(r => ({ id: r, label: r }));
  }
};

export const saveRoles = async (roles: {id: string, label: string}[]): Promise<void> => {
  try {
    // Bulk update - we'll update each role individually
    for (const role of roles) {
      await apiCall(`/api/roles/${role.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: role.label,
          slug: role.label.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          sort_order: role.sort_order || 0,
          header_bg_color: role.header_bg_color || null,
          is_active: role.is_active !== false
        })
      });
    }
  } catch (e) {
    console.error('Failed to save roles:', e);
    localStorage.setItem('polpo_roles', JSON.stringify(roles));
  }
};

// ===== EMPLOYEES =====
export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const employees = await apiCall('/api/employees');
    // S'assurer que c'est bien un tableau
    if (!Array.isArray(employees)) {
      console.warn('API returned non-array for employees, using empty array');
      return [];
    }
    return employees.map((e: any) => ({
      id: e.id,
      name: e.display_name || `${e.first_name} ${e.last_name}`,
      role: e.role_name || 'Employé',
      isActive: e.status === 'active',
      isExternal: e.is_external === 1,
      externalCategory: e.external_category,
      contractHoursWeek: e.contract_hours_week,
      contractType: e.contract_type,
      email: e.email,
      phone: e.phone,
      weeklyDefault: {}
    }));
  } catch (e) {
    console.warn('API failed, using localStorage fallback for employees');
    const fallbackEmployees = localStorage.getItem('polpo_employees');
    return fallbackEmployees ? JSON.parse(fallbackEmployees) : [];
  }
};

export const saveEmployees = async (employees: Employee[]): Promise<void> => {
  try {
    // Bulk update - update each employee individually
    for (const employee of employees) {
      const nameParts = employee.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      await apiCall(`/api/employees/${employee.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          display_name: employee.name,
          role_id: employee.role === 'Employé' ? null : employee.role,
          status: employee.isActive ? 'active' : 'inactive',
          is_external: employee.isExternal ? 1 : 0,
          external_category: employee.externalCategory,
          contract_hours_week: employee.contractHoursWeek,
          contract_type: employee.contractType,
          email: employee.email,
          phone: employee.phone
        })
      });
    }
  } catch (e) {
    console.error('Failed to save employees:', e);
    localStorage.setItem('polpo_employees', JSON.stringify(employees));
  }
};

// ===== SHIFT CODES =====
export const getShiftCodes = async (): Promise<any[]> => {
  try {
    const shiftCodes = await apiCall('/api/shift-codes');
    // S'assurer que c'est bien un tableau
    if (!Array.isArray(shiftCodes)) {
      console.warn('API returned non-array for shift codes, using empty array');
      return [];
    }
    return shiftCodes.map((sc: any) => ({
      code: sc.code,
      label: sc.label,
      defaultColor: sc.default_color,
      defaultStartMidi: sc.default_start_midi,
      defaultEndMidi: sc.default_end_midi,
      defaultStartSoir: sc.default_start_soir,
      defaultEndSoir: sc.default_end_soir,
      isAbsence: sc.is_absence === 1,
      isRest: sc.is_rest === 1
    }));
  } catch (e) {
    console.warn('API failed, using localStorage fallback for shift codes');
    const fallbackShiftCodes = localStorage.getItem('polpo_shift_codes');
    return fallbackShiftCodes ? JSON.parse(fallbackShiftCodes) : [];
  }
};

// ===== SETTINGS =====
export const getSettings = async (scope: string = 'global'): Promise<any> => {
  try {
    const settings = await apiCall(`/api/settings?scope=${scope}`);
    // S'assurer que c'est bien un tableau
    if (!Array.isArray(settings)) {
      console.warn('API returned non-array for settings, using empty object');
      return {};
    }
    const result: any = {};
    settings.forEach((s: any) => {
      result[s.key] = s.value_json;
    });
    return result;
  } catch (e) {
    console.warn('API failed, using localStorage fallback for settings');
    const fallbackSettings = localStorage.getItem(`polpo_settings_${scope}`);
    return fallbackSettings ? JSON.parse(fallbackSettings) : {};
  }
};

// ===== TEMPLATES (Legacy support) =====
export const getTemplates = async (): Promise<Template[]> => {
  try {
    // For now, templates are stored in settings
    const settings = await getSettings();
    const templates = settings.templates || [];
    // S'assurer que c'est bien un tableau
    if (!Array.isArray(templates)) {
      console.warn('Templates is not an array, using empty array');
      return [];
    }
    return templates;
  } catch (e) {
    console.warn('API failed, using localStorage fallback for templates');
    const fallbackTemplates = localStorage.getItem('polpo_templates');
    return fallbackTemplates ? JSON.parse(fallbackTemplates) : [];
  }
};

// ===== PLANNINGS (Legacy support) =====
export const getPlannings = async (): Promise<Planning[]> => {
  try {
    // For now, plannings are stored in settings
    const settings = await getSettings();
    const plannings = settings.plannings || [];
    // S'assurer que c'est bien un tableau
    if (!Array.isArray(plannings)) {
      console.warn('Plannings is not an array, using empty array');
      return [];
    }
    return plannings;
  } catch (e) {
    console.warn('API failed, using localStorage fallback for plannings');
    const fallbackPlannings = localStorage.getItem('polpo_plannings');
    return fallbackPlannings ? JSON.parse(fallbackPlannings) : [];
  }
};

export const savePlannings = async (plannings: Planning[]): Promise<void> => {
  try {
    await saveSetting('global', 'plannings', plannings);
  } catch (e) {
    console.error('Failed to save plannings:', e);
    localStorage.setItem('polpo_plannings', JSON.stringify(plannings));
  }
};

export const createPlanning = async (inputDate: Date, service: 'Salle' | 'Cuisine'): Promise<Planning> => {
  try {
    const weekStart = startOfWeek(inputDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    const newPlanning = {
      id: crypto.randomUUID(),
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      service: service,
      status: 'active',
      createdAt: new Date().toISOString(),
      rows: [],
      extraShifts: []
    };
    
    const plannings = await getPlannings();
    plannings.push(newPlanning);
    await savePlannings(plannings);
    
    return newPlanning;
  } catch (e) {
    console.error('Failed to create planning:', e);
    throw e;
  }
};

export const updatePlanning = async (updated: Planning): Promise<void> => {
  try {
    const plannings = await getPlannings();
    const index = plannings.findIndex(p => p.id === updated.id);
    if (index !== -1) {
      plannings[index] = updated;
      await savePlannings(plannings);
    }
  } catch (e) {
    console.error('Failed to update planning:', e);
    throw e;
  }
};

export const deletePlanning = async (id: string): Promise<void> => {
  try {
    const plannings = await getPlannings();
    const filteredPlannings = plannings.filter(p => p.id !== id);
    await savePlannings(filteredPlannings);
  } catch (e) {
    console.error('Failed to delete planning:', e);
    throw e;
  }
};

export const saveSetting = async (scope: string, key: string, value: any): Promise<void> => {
  try {
    await apiCall(`/api/settings/${scope}/${key}`, {
      method: 'PUT',
      body: JSON.stringify({
        value_json: value
      })
    });
  } catch (e) {
    console.error('Failed to save setting:', e);
    const settings = getSettings(scope) || {};
    settings[key] = value;
    localStorage.setItem(`polpo_settings_${scope}`, JSON.stringify(settings));
  }
};

// ===== INIT MOCK DATA =====
export const initMockData = async (): Promise<void> => {
  try {
    console.log('🔄 Initializing data from API...');
    
    // Check if we have data
    const employees = await getEmployees();
    const roles = await getRoles();
    const shiftCodes = await getShiftCodes();
    
    if (employees.length === 0) {
      console.log('📝 No employees found, you may need to create some manually');
    }
    
    if (roles.length === 0) {
      console.log('📝 No roles found, you may need to create some manually');
    }
    
    if (shiftCodes.length === 0) {
      console.log('📝 No shift codes found, you may need to create some manually');
    }
    
    console.log('✅ API initialization complete');
  } catch (e) {
    console.error('❌ API initialization failed, using localStorage fallback');
    // Fallback to localStorage initialization
    const fallbackEmployees = localStorage.getItem('polpo_employees');
    const fallbackRoles = localStorage.getItem('polpo_roles');
    
    if (!fallbackRoles) {
      const defaultRoles = STANDARD_ROLES.filter(r => r !== 'GÉNÉRAL').map(r => ({ id: r, label: r }));
      localStorage.setItem('polpo_roles', JSON.stringify(defaultRoles));
    }
    
    if (!fallbackEmployees) {
      localStorage.setItem('polpo_employees', JSON.stringify([]));
    }
  }
};

// Export all functions
export {
  apiCall
};
