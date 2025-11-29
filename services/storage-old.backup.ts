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

// Fallback localStorage functions (emergency only)
const fallbackGet = (key: string) => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

const fallbackSet = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ===== ROLES =====
export const getRoles = async (): Promise<{id: string, label: string}[]> => {
  try {
    const roles = await apiCall('/api/roles');
    return roles.map((r: any) => ({
      id: r.id,
      label: r.name,
      ...r
    }));
  } catch (e) {
    console.warn('API failed, using localStorage fallback for roles');
    const fallbackRoles = fallbackGet('polpo_roles');
    return fallbackRoles || STANDARD_ROLES.filter(r => r !== 'GÉNÉRAL').map(r => ({ id: r, label: r }));
  }
};

export const saveRoles = async (roles: {id: string, label: string}[]): Promise<void> => {
  try {
    // For now, roles are managed through separate endpoints
    // This is a bulk operation - we'd need to implement batch updates
    console.warn('Bulk role save not implemented - use individual role endpoints');
    fallbackSet('polpo_roles', roles);
  } catch (e) {
    console.error('Failed to save roles:', e);
    fallbackSet('polpo_roles', roles);
  }
};

export const addRole = async (role: {id: string, label: string}): Promise<void> => {
  try {
    await apiCall('/api/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: role.label,
        slug: role.label.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        sort_order: 0,
        header_bg_color: null,
        is_active: 1
      })
    });
  } catch (e) {
    console.error('Failed to add role:', e);
    throw e;
  }
};

export const updateRole = async (role: {id: string, label: string}): Promise<void> => {
  try {
    await apiCall(`/api/roles/${role.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: role.label,
        slug: role.label.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        sort_order: 0,
        header_bg_color: null,
        is_active: 1
      })
    });
  } catch (e) {
    console.error('Failed to update role:', e);
    throw e;
  }
};

export const deleteRole = async (id: string): Promise<void> => {
  try {
    await apiCall(`/api/roles/${id}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.error('Failed to delete role:', e);
    throw e;
  }
};

// ===== EMPLOYEES =====
export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const employees = await apiCall('/api/employees');
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
    return fallbackGet('polpo_employees') || [];
  }
};

export const saveEmployees = async (employees: Employee[]): Promise<void> => {
  try {
    // For bulk operations, we'd need to implement batch updates
    console.warn('Bulk employee save not implemented - use individual employee endpoints');
    fallbackSet('polpo_employees', employees);
  } catch (e) {
    console.error('Failed to save employees:', e);
    fallbackSet('polpo_employees', employees);
  }
};

export const addEmployee = async (employee: Omit<Employee, 'id'>): Promise<Employee> => {
  try {
    const nameParts = employee.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const newEmployee = await apiCall('/api/employees', {
      method: 'POST',
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
    
    return {
      id: newEmployee.id,
      name: newEmployee.display_name,
      role: newEmployee.role_name || employee.role,
      isActive: newEmployee.status === 'active',
      isExternal: newEmployee.is_external === 1,
      externalCategory: newEmployee.external_category,
      contractHoursWeek: newEmployee.contract_hours_week,
      contractType: newEmployee.contract_type,
      email: newEmployee.email,
      phone: newEmployee.phone,
      weeklyDefault: employee.weeklyDefault
    };
  } catch (e) {
    console.error('Failed to add employee:', e);
    throw e;
  }
};

export const updateEmployee = async (employee: Employee): Promise<void> => {
  try {
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
  } catch (e) {
    console.error('Failed to update employee:', e);
    throw e;
  }
};

export const deleteEmployee = async (id: string): Promise<void> => {
  try {
    await apiCall(`/api/employees/${id}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.error('Failed to delete employee:', e);
    throw e;
  }
};

export const updateEmployeeDetails = async (id: string, name: string, role: string): Promise<void> => {
  try {
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    await apiCall(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        display_name: name,
        role_id: role === 'Employé' ? null : role,
        status: 'active'
      })
    });
  } catch (e) {
    console.error('Failed to update employee details:', e);
    throw e;
  }
};

// ===== TEMPLATES =====
export const getTemplates = async (): Promise<Template[]> => {
  try {
    const templates = await apiCall('/api/templates');
    return templates.map((t: any) => ({
      id: t.id,
      name: t.name,
      role: t.role_name,
      serviceType: t.service_type as ShiftServiceType,
      slots: t.slots || [],
      color: t.color
    }));
  } catch (e) {
    console.warn('API failed, using localStorage fallback for templates');
    return fallbackGet('polpo_templates') || [];
  }
};

export const saveTemplates = async (templates: Template[]): Promise<void> => {
  try {
    console.warn('Bulk template save not implemented - use individual template endpoints');
    fallbackSet('polpo_templates', templates);
  } catch (e) {
    console.error('Failed to save templates:', e);
    fallbackSet('polpo_templates', templates);
  }
};

export const updateTemplate = async (updated: Template): Promise<void> => {
  try {
    await apiCall(`/api/templates/${updated.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: updated.name,
        role_id: updated.role,
        service_type: updated.serviceType,
        color: updated.color,
        slots: updated.slots
      })
    });
  } catch (e) {
    console.error('Failed to update template:', e);
    throw e;
  }
};

export const deleteTemplate = async (id: string, reassignTplId?: string): Promise<void> => {
  try {
    await apiCall(`/api/templates/${id}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.error('Failed to delete template:', e);
    throw e;
  }
};

// ===== PLANNINGS =====
export const getPlannings = async (): Promise<Planning[]> => {
  try {
    const plannings = await apiCall('/api/plannings');
    return plannings.map((p: any) => ({
      id: p.id,
      weekStart: p.week_start,
      weekEnd: p.week_end,
      service: p.service,
      status: p.status,
      createdAt: p.created_at,
      rows: (p.rows || []).map((row: any) => ({
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        employeeRole: row.employee_role,
        isExtra: row.is_extra === 1,
        shifts: {}
      })),
      extraShifts: []
    }));
  } catch (e) {
    console.warn('API failed, using localStorage fallback for plannings');
    return fallbackGet('polpo_plannings') || [];
  }
};

export const savePlannings = async (plannings: Planning[]): Promise<void> => {
  try {
    console.warn('Bulk planning save not implemented - use individual planning endpoints');
    fallbackSet('polpo_plannings', plannings);
  } catch (e) {
    console.error('Failed to save plannings:', e);
    fallbackSet('polpo_plannings', plannings);
  }
};

export const createPlanning = async (inputDate: Date, service: 'Salle' | 'Cuisine'): Promise<Planning> => {
  try {
    const weekStart = startOfWeek(inputDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
    
    const newPlanning = await apiCall('/api/plannings', {
      method: 'POST',
      body: JSON.stringify({
        week_start: weekStartStr,
        week_end: weekEndStr,
        service: service,
        status: 'active',
        rows: [] // Will be populated separately
      })
    });
    
    return {
      id: newPlanning.id,
      weekStart: newPlanning.week_start,
      weekEnd: newPlanning.week_end,
      service: newPlanning.service,
      status: newPlanning.status,
      createdAt: newPlanning.created_at,
      rows: [],
      extraShifts: []
    };
  } catch (e) {
    console.error('Failed to create planning:', e);
    throw e;
  }
};

export const updatePlanning = async (updated: Planning): Promise<void> => {
  try {
    await apiCall(`/api/plannings/${updated.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        week_start: updated.weekStart,
        week_end: updated.weekEnd,
        service: updated.service,
        status: updated.status,
        rows: updated.rows.map(row => ({
          employee_id: row.employeeId,
          employee_name: row.employeeName,
          employee_role: row.employeeRole,
          is_extra: row.isExtra ? 1 : 0
        }))
      })
    });
  } catch (e) {
    console.error('Failed to update planning:', e);
    throw e;
  }
};

export const deletePlanning = async (id: string): Promise<void> => {
  try {
    await apiCall(`/api/plannings/${id}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.error('Failed to delete planning:', e);
    throw e;
  }
};

// ===== SETTINGS =====
export const getSettings = async (scope: string = 'global'): Promise<any> => {
  try {
    const settings = await apiCall(`/api/settings?scope=${scope}`);
    const result: any = {};
    settings.forEach((s: any) => {
      result[s.key] = s.value_json;
    });
    return result;
  } catch (e) {
    console.warn('API failed, using localStorage fallback for settings');
    return fallbackGet(`polpo_settings_${scope}`) || {};
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
    const settings = fallbackGet(`polpo_settings_${scope}`) || {};
    settings[key] = value;
    fallbackSet(`polpo_settings_${scope}`, settings);
  }
};

// ===== INIT MOCK DATA =====
export const initMockData = async (): Promise<void> => {
  try {
    console.log('🔄 Initializing data from API...');
    
    // Check if we have data
    const employees = await getEmployees();
    const roles = await getRoles();
    
    if (employees.length === 0) {
      console.log('📝 No employees found, you may need to create some manually');
    }
    
    if (roles.length === 0) {
      console.log('📝 No roles found, you may need to create some manually');
    }
    
    console.log('✅ API initialization complete');
  } catch (e) {
    console.error('❌ API initialization failed, using localStorage fallback');
    // Fallback to localStorage initialization
    const fallbackEmployees = fallbackGet('polpo_employees');
    const fallbackRoles = fallbackGet('polpo_roles');
    
    if (!fallbackRoles) {
      const defaultRoles = STANDARD_ROLES.filter(r => r !== 'GÉNÉRAL').map(r => ({ id: r, label: r }));
      fallbackSet('polpo_roles', defaultRoles);
    }
    
    if (!fallbackEmployees) {
      fallbackSet('polpo_employees', []);
    }
  }
};

// Export all functions
export {
  apiCall,
  fallbackGet,
  fallbackSet
};
