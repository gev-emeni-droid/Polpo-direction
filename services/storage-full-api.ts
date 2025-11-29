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

export const addRole = async (role: {id: string, label: string, header_bg_color?: string}): Promise<{id: string, label: string}> => {
  try {
    const newRole = await apiCall('/api/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: role.label,
        slug: role.label.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        sort_order: 0,
        header_bg_color: role.header_bg_color || null,
        is_active: 1
      })
    });
    
    return {
      id: newRole.id,
      label: newRole.name,
      header_bg_color: newRole.header_bg_color
    };
  } catch (e) {
    console.error('Failed to add role:', e);
    throw e;
  }
};

export const updateRole = async (role: {id: string, label: string, header_bg_color?: string, sort_order?: number, is_active?: boolean}): Promise<void> => {
  try {
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

export const saveShiftCodes = async (shiftCodes: any[]): Promise<void> => {
  try {
    // Bulk update - update each shift code individually
    for (const shiftCode of shiftCodes) {
      await apiCall(`/api/shift-codes/${shiftCode.code}`, {
        method: 'PUT',
        body: JSON.stringify({
          label: shiftCode.label,
          default_color: shiftCode.defaultColor,
          default_start_midi: shiftCode.defaultStartMidi,
          default_end_midi: shiftCode.defaultEndMidi,
          default_start_soir: shiftCode.defaultStartSoir,
          default_end_soir: shiftCode.defaultEndSoir,
          is_absence: shiftCode.isAbsence ? 1 : 0,
          is_rest: shiftCode.isRest ? 1 : 0
        })
      });
    }
  } catch (e) {
    console.error('Failed to save shift codes:', e);
    localStorage.setItem('polpo_shift_codes', JSON.stringify(shiftCodes));
  }
};

export const addShiftCode = async (shiftCode: any): Promise<any> => {
  try {
    const newShiftCode = await apiCall('/api/shift-codes', {
      method: 'POST',
      body: JSON.stringify({
        code: shiftCode.code,
        label: shiftCode.label,
        default_color: shiftCode.defaultColor,
        default_start_midi: shiftCode.defaultStartMidi,
        default_end_midi: shiftCode.defaultEndMidi,
        default_start_soir: shiftCode.defaultStartSoir,
        default_end_soir: shiftCode.defaultEndSoir,
        is_absence: shiftCode.isAbsence ? 1 : 0,
        is_rest: shiftCode.isRest ? 1 : 0
      })
    });
    
    return {
      code: newShiftCode.code,
      label: newShiftCode.label,
      defaultColor: newShiftCode.default_color,
      defaultStartMidi: newShiftCode.default_start_midi,
      defaultEndMidi: newShiftCode.default_end_midi,
      defaultStartSoir: newShiftCode.default_start_soir,
      defaultEndSoir: newShiftCode.default_end_soir,
      isAbsence: newShiftCode.is_absence === 1,
      isRest: newShiftCode.is_rest === 1
    };
  } catch (e) {
    console.error('Failed to add shift code:', e);
    throw e;
  }
};

// ===== SHIFTS (PLANNING) =====
export const getShifts = async (filters?: {employee_id?: string, date_start?: string, date_end?: string}): Promise<any[]> => {
  try {
    const params = new URLSearchParams();
    if (filters?.employee_id) params.append('employee_id', filters.employee_id);
    if (filters?.date_start) params.append('date_start', filters.date_start);
    if (filters?.date_end) params.append('date_end', filters.date_end);
    
    const shifts = await apiCall(`/api/shifts?${params}`);
    return shifts.map((s: any) => ({
      id: s.id,
      employeeId: s.employee_id,
      employeeName: s.display_name || `${s.first_name} ${s.last_name}`,
      date: s.date,
      roleId: s.role_id,
      roleName: s.role_name,
      notes: s.notes,
      segments: s.segments || []
    }));
  } catch (e) {
    console.warn('API failed, using localStorage fallback for shifts');
    const fallbackShifts = localStorage.getItem('polpo_shifts');
    return fallbackShifts ? JSON.parse(fallbackShifts) : [];
  }
};

export const saveShift = async (shift: any): Promise<any> => {
  try {
    if (shift.id) {
      // Update existing shift
      const updatedShift = await apiCall(`/api/shifts/${shift.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          role_id: shift.roleId,
          notes: shift.notes,
          segments: shift.segments || []
        })
      });
      
      return {
        id: updatedShift.id,
        employeeId: updatedShift.employee_id,
        employeeName: updatedShift.display_name || `${updatedShift.first_name} ${updatedShift.last_name}`,
        date: updatedShift.date,
        roleId: updatedShift.role_id,
        roleName: updatedShift.role_name,
        notes: updatedShift.notes,
        segments: updatedShift.segments || []
      };
    } else {
      // Create new shift
      const newShift = await apiCall('/api/shifts', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: shift.employeeId,
          date: shift.date,
          role_id: shift.roleId,
          notes: shift.notes,
          segments: shift.segments || []
        })
      });
      
      return {
        id: newShift.id,
        employeeId: newShift.employee_id,
        employeeName: newShift.display_name || `${newShift.first_name} ${newShift.last_name}`,
        date: newShift.date,
        roleId: newShift.role_id,
        roleName: newShift.role_name,
        notes: newShift.notes,
        segments: newShift.segments || []
      };
    }
  } catch (e) {
    console.error('Failed to save shift:', e);
    throw e;
  }
};

export const deleteShift = async (id: string): Promise<void> => {
  try {
    await apiCall(`/api/shifts/${id}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.error('Failed to delete shift:', e);
    throw e;
  }
};

// ===== ABSENCES =====
export const getAbsences = async (filters?: {employee_id?: string, start_date?: string, end_date?: string}): Promise<any[]> => {
  try {
    const params = new URLSearchParams();
    if (filters?.employee_id) params.append('employee_id', filters.employee_id);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    
    const absences = await apiCall(`/api/absences?${params}`);
    return absences.map((a: any) => ({
      id: a.id,
      employeeId: a.employee_id,
      employeeName: a.display_name || `${a.first_name} ${a.last_name}`,
      startDate: a.start_date,
      endDate: a.end_date,
      code: a.code,
      codeLabel: a.code_label,
      codeColor: a.code_color,
      notes: a.notes
    }));
  } catch (e) {
    console.warn('API failed, using localStorage fallback for absences');
    const fallbackAbsences = localStorage.getItem('polpo_absences');
    return fallbackAbsences ? JSON.parse(fallbackAbsences) : [];
  }
};

export const saveAbsence = async (absence: any): Promise<any> => {
  try {
    if (absence.id) {
      // Update existing absence
      const updatedAbsence = await apiCall(`/api/absences/${absence.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          start_date: absence.startDate,
          end_date: absence.endDate,
          code: absence.code,
          notes: absence.notes
        })
      });
      
      return {
        id: updatedAbsence.id,
        employeeId: updatedAbsence.employee_id,
        employeeName: updatedAbsence.display_name || `${updatedAbsence.first_name} ${updatedAbsence.last_name}`,
        startDate: updatedAbsence.start_date,
        endDate: updatedAbsence.end_date,
        code: updatedAbsence.code,
        codeLabel: updatedAbsence.code_label,
        codeColor: updatedAbsence.code_color,
        notes: updatedAbsence.notes
      };
    } else {
      // Create new absence
      const newAbsence = await apiCall('/api/absences', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: absence.employeeId,
          start_date: absence.startDate,
          end_date: absence.endDate,
          code: absence.code,
          notes: absence.notes
        })
      });
      
      return {
        id: newAbsence.id,
        employeeId: newAbsence.employee_id,
        employeeName: newAbsence.display_name || `${newAbsence.first_name} ${newAbsence.last_name}`,
        startDate: newAbsence.start_date,
        endDate: newAbsence.end_date,
        code: newAbsence.code,
        codeLabel: newAbsence.code_label,
        codeColor: newAbsence.code_color,
        notes: newAbsence.notes
      };
    }
  } catch (e) {
    console.error('Failed to save absence:', e);
    throw e;
  }
};

export const deleteAbsence = async (id: string): Promise<void> => {
  try {
    await apiCall(`/api/absences/${id}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.error('Failed to delete absence:', e);
    throw e;
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

export const saveSettings = async (scope: string, settings: any): Promise<void> => {
  try {
    // Save each setting individually
    for (const [key, value] of Object.entries(settings)) {
      await saveSetting(scope, key, value);
    }
  } catch (e) {
    console.error('Failed to save settings:', e);
    localStorage.setItem(`polpo_settings_${scope}`, JSON.stringify(settings));
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

export const saveTemplates = async (templates: Template[]): Promise<void> => {
  try {
    await saveSetting('global', 'templates', templates);
  } catch (e) {
    console.error('Failed to save templates:', e);
    localStorage.setItem('polpo_templates', JSON.stringify(templates));
  }
};

export const updateTemplate = async (updated: Template): Promise<void> => {
  try {
    const templates = await getTemplates();
    const index = templates.findIndex(t => t.id === updated.id);
    if (index !== -1) {
      templates[index] = updated;
      await saveTemplates(templates);
    }
  } catch (e) {
    console.error('Failed to update template:', e);
    throw e;
  }
};

export const deleteTemplate = async (id: string, reassignTplId?: string): Promise<void> => {
  try {
    const templates = await getTemplates();
    const filteredTemplates = templates.filter(t => t.id !== id);
    await saveTemplates(filteredTemplates);
  } catch (e) {
    console.error('Failed to delete template:', e);
    throw e;
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
