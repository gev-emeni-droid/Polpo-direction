import { Employee, Planning, Template, STANDARD_ROLES, ShiftServiceType, ShiftSegment } from '../types';
import { addDays, format, parseISO, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { API_BASE_URL } from '../src/config';

const STORAGE_KEYS = {
  EMPLOYEES: 'polpo_employees',
  TEMPLATES: 'polpo_templates',
  PLANNINGS: 'polpo_plannings',
  ROLES: 'polpo_roles'
};

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
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('API call failed, falling back to localStorage:', error);
    throw error;
  }
};

// Fallback localStorage functions
const fallbackGet = (key: string) => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

const fallbackSet = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- Helpers ---

export const getRoles = () => {
  // For compatibility, make it sync but call async internally
  try {
    // Try to get from API async but don't wait
    apiCall('/api/roles').then(response => {
      const roles = response.data.map((role: any) => ({
        id: role.id,
        label: role.name
      }));
      // Cache in localStorage for immediate access
      fallbackSet(STORAGE_KEYS.ROLES, roles);
    }).catch(() => {
      // API failed, use localStorage
    });
  } catch (error) {
    // Ignore API errors
  }
  
  // Return from localStorage immediately (sync)
  const storedRoles = fallbackGet(STORAGE_KEYS.ROLES);
  if (storedRoles) {
      return storedRoles;
  }
  // Fallback / Init from STANDARD_ROLES if empty
  const roles = STANDARD_ROLES.filter(r => r !== 'GÉNÉRAL').map(r => ({ id: r, label: r }));
  return roles;
};

export const saveRoles = (roles: {id: string, label: string}[]) => {
  // Save to localStorage immediately
  fallbackSet(STORAGE_KEYS.ROLES, roles);
  
  // Try to sync with API async
  try {
    apiCall('/api/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: roles[roles.length - 1]?.label || 'New Role',
        slug: roles[roles.length - 1]?.id?.toLowerCase() || 'new-role',
        sort_order: roles.length
      })
    }).catch(() => {
      // API failed, but localStorage is saved
    });
  } catch (error) {
    // Ignore API errors
  }
};

export const addRole = (label: string) => {
    const roles = getRoles();
    const newId = label.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    // Ensure uniqueness
    if (roles.find(r => r.id === newId)) return;
    
    const newRoles = [...roles, { id: newId, label }];
    saveRoles(newRoles);
};

export const updateRole = (id: string, newLabel: string) => {
    let roles = getRoles();
    const roleIndex = roles.findIndex(r => r.id === id);
    if (roleIndex === -1) return;
    
    const oldLabel = roles[roleIndex].label;
    roles[roleIndex].label = newLabel;
    saveRoles(roles);

    // Cascade Update: Employees
    const employees = getEmployees();
    const updatedEmps = employees.map(e => {
        if (e.role === id || e.role === oldLabel) return { ...e, role: id }; // Ensure ID consistency
        return e;
    });
    saveEmployees(updatedEmps);

    // Cascade Update: Templates
    const templates = getTemplates();
    const updatedTpls = templates.map(t => {
        if (t.role === id || t.role === oldLabel) return { ...t, role: id };
        return t;
    });
    saveTemplates(updatedTpls);
};

export const deleteRole = (id: string, reassignRoleId?: string) => {
    let roles = getRoles();
    roles = roles.filter(r => r.id !== id);
    saveRoles(roles);

    if (reassignRoleId) {
        // Reassign Employees
        const employees = getEmployees();
        const updatedEmps = employees.map(e => {
            if (e.role === id) return { ...e, role: reassignRoleId };
            return e;
        });
        saveEmployees(updatedEmps);

        // Reassign Templates
        const templates = getTemplates();
        const updatedTpls = templates.map(t => {
            if (t.role === id) return { ...t, role: reassignRoleId };
            return t;
        });
        saveTemplates(updatedTpls);
    }
};

export const getEmployees = (): Employee[] => {
  // For compatibility, make it sync but call async internally
  try {
    // Try to get from API async but don't wait
    apiCall('/api/employees').then(response => {
      const employees = response.data.map((emp: any) => ({
        id: emp.id,
        name: emp.display_name || `${emp.first_name} ${emp.last_name}`,
        role: emp.role_name || emp.role_id,
        isActive: emp.status === 'active',
        weeklyDefault: {} // TODO: Load from shifts or separate table
      }));
      // Cache in localStorage for immediate access
      fallbackSet(STORAGE_KEYS.EMPLOYEES, employees);
    }).catch(() => {
      // API failed, use localStorage
    });
  } catch (error) {
    // Ignore API errors
  }
  
  // Return from localStorage immediately (sync)
  const data = fallbackGet(STORAGE_KEYS.EMPLOYEES);
  return data || [];
};

export const saveEmployees = (employees: Employee[]) => {
  // Save to localStorage immediately
  fallbackSet(STORAGE_KEYS.EMPLOYEES, employees);
  
  // Try to sync with API async
  try {
    // For now just log, full sync would be complex
    console.log('Employees saved to localStorage, API sync pending');
  } catch (error) {
    // Ignore API errors
  }
};

export const updateEmployeeDetails = (id: string, name: string, role: string) => {
    // 1. Update Global Employee List
    const employees = getEmployees();
    const idx = employees.findIndex(e => e.id === id);
    if (idx !== -1) {
        employees[idx] = { ...employees[idx], name, role };
        saveEmployees(employees);
    }

    // 2. Cascade Update to ALL Plannings (Rows)
    // This ensures the employee moves to the correct group and shows the new name immediately
    const plannings = getPlannings();
    let changed = false;
    const updatedPlannings = plannings.map(p => {
        const rowIdx = p.rows.findIndex(r => r.employeeId === id);
        if (rowIdx !== -1) {
            // Found employee row, update it
            const updatedRows = [...p.rows];
            updatedRows[rowIdx] = {
                ...updatedRows[rowIdx],
                employeeName: name,
                employeeRole: role
            };
            changed = true;
            return { ...p, rows: updatedRows };
        }
        return p;
    });

    if (changed) {
        savePlannings(updatedPlannings);
    }
};

export const getTemplates = (): Template[] => {
  // For now, keep templates in localStorage as they are complex
  const data = fallbackGet(STORAGE_KEYS.TEMPLATES);
  return data || [];
};

export const saveTemplates = (templates: Template[]) => {
  // For now, keep templates in localStorage
  fallbackSet(STORAGE_KEYS.TEMPLATES, templates);
};

export const updateTemplate = (updated: Template) => {
    const templates = getTemplates();
    const idx = templates.findIndex(t => t.id === updated.id);
    if (idx === -1) return;
    
    templates[idx] = updated;
    saveTemplates(templates);

    // Cascade: Update segments in plannings that use this template AND have no manual override
    const plannings = getPlannings();
    let changed = false;

    const newPlannings = plannings.map(p => {
        let rowChanged = false;
        const newRows = p.rows.map(row => {
            let shiftChanged = false;
            const newShifts = { ...row.shifts };
            
            Object.keys(newShifts).forEach(date => {
                const shift = newShifts[date];
                if (shift.segments) {
                    const newSegments: ShiftSegment[] = [];
                    let segChanged = false;
                    
                    shift.segments.forEach(seg => {
                        // If segment is linked to this template and NOT overridden
                        if (seg.templateId === updated.id && !seg.hasOverride) {
                            segChanged = true;
                            // Replace with new slots from template
                            updated.slots.forEach(slot => {
                                newSegments.push({
                                    type: 'horaire',
                                    start: slot.start,
                                    end: slot.end,
                                    templateId: updated.id,
                                    hasOverride: false
                                    // colorOverride is usually undefined here, so it picks up new default
                                });
                            });
                        } else {
                            newSegments.push(seg);
                        }
                    });

                    if (segChanged) {
                        // Re-sort segments chronologically
                        newSegments.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
                        
                        // Recalculate Service Type
                        let serviceType: ShiftServiceType = 'none';
                        const hasMidi = newSegments.some(s => s.type === 'horaire' && s.start && s.start < "16:00");
                        const hasSoir = newSegments.some(s => s.type === 'horaire' && s.end && s.end >= "16:00");
                        
                        if (hasMidi && hasSoir) serviceType = 'midi+soir';
                        else if (hasMidi) serviceType = 'midi';
                        else if (hasSoir) serviceType = 'soir';

                        newShifts[date] = {
                            ...shift,
                            serviceType,
                            segments: newSegments
                        };
                        shiftChanged = true;
                    }
                }
            });

            if (shiftChanged) {
                rowChanged = true;
                return { ...row, shifts: newShifts };
            }
            return row;
        });

        if (rowChanged) {
            changed = true;
            return { ...p, rows: newRows };
        }
        return p;
    });

    if (changed) {
        savePlannings(newPlannings);
    }
};

export const deleteTemplate = (id: string, reassignTplId?: string) => {
    let templates = getTemplates();
    templates = templates.filter(t => t.id !== id);
    saveTemplates(templates);

    // Update Employee Defaults
    const employees = getEmployees();
    let empChanged = false;
    const updatedEmps = employees.map(emp => {
        if (!emp.weeklyDefault) return emp;
        const newDef = { ...emp.weeklyDefault };
        let modified = false;
        
        Object.keys(newDef).forEach(day => {
            if (newDef[day] === id) {
                if (reassignTplId && reassignTplId !== 'repos') {
                    newDef[day] = reassignTplId;
                } else {
                    delete newDef[day]; // or set to 'repos'
                }
                modified = true;
            }
        });

        if (modified) {
            empChanged = true;
            return { ...emp, weeklyDefault: newDef };
        }
        return emp;
    });

    if (empChanged) {
        saveEmployees(updatedEmps);
    }
};

export const getPlannings = (): Planning[] => {
  // For now, keep plannings in localStorage as they are complex
  let data = fallbackGet(STORAGE_KEYS.PLANNINGS);
  let plannings: Planning[] = data || [];

  // Auto-archive logic
  const today = startOfDay(new Date());
  let changed = false;
  plannings = plannings.map(p => {
    const weekEnd = parseISO(p.weekEnd);
    if (p.status === 'active' && isBefore(weekEnd, today)) {
      changed = true;
      return { ...p, status: 'archived' };
    }
    return p;
  });

  if (changed) {
    savePlannings(plannings);
  }

  return plannings;
};

export const savePlannings = (plannings: Planning[]) => {
  // For now, keep plannings in localStorage
  fallbackSet(STORAGE_KEYS.PLANNINGS, plannings);
};

export const createPlanning = (inputDate: Date, service: 'Salle' | 'Cuisine'): Planning => {
  // Enforce start of week (Monday)
  const weekStart = startOfWeek(inputDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  
  const employees = getEmployees();
  const activeEmployees = employees.filter(e => e.isActive);
  const templates = getTemplates();

  const newPlanning: Planning = {
    id: crypto.randomUUID(),
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    service,
    status: 'active',
    createdAt: Date.now(),
    rows: activeEmployees.map(emp => {
      const shifts: Record<string, any> = {};

      for (let i = 0; i < 7; i++) {
        const dateStr = format(addDays(weekStart, i), 'yyyy-MM-dd');
        
        // --- KEY LOGIC: Use Weekly Default from Employee Settings ---
        const defaultTplId = emp.weeklyDefault?.[i.toString()];
        const tpl = defaultTplId ? templates.find(t => t.id === defaultTplId) : null;

        const segments: ShiftSegment[] = [];
        let shiftType = 'repos';
        let shiftServiceType = 'none';

        if (tpl) {
            shiftType = 'travail';
            shiftServiceType = tpl.serviceType;
            tpl.slots.forEach(slot => {
                segments.push({
                    type: 'horaire',
                    start: slot.start,
                    end: slot.end,
                    templateId: tpl.id, // Link to template for coloring
                    hasOverride: false
                });
            });
        } else if (defaultTplId === 'repos') {
             shiftType = 'repos';
             segments.push({ type: 'code', label: 'REPOS' });
        } else {
             // Fallback default if nothing configured
             shiftType = 'repos';
             segments.push({ type: 'code', label: 'REPOS' });
        }

        shifts[dateStr] = {
            date: dateStr,
            type: shiftType,
            serviceType: shiftServiceType,
            segments: segments
        };
      }

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        isExtra: false,
        shifts
      };
    }),
    extraShifts: [] 
  };

  const current = getPlannings();
  savePlannings([...current, newPlanning]);
  return newPlanning;
};

export const updatePlanning = (updated: Planning) => {
  const all = getPlannings();
  const index = all.findIndex(p => p.id === updated.id);
  if (index !== -1) {
    all[index] = updated;
    savePlannings(all);
  }
};

export const deletePlanning = (id: string) => {
  const all = getPlannings().filter(p => p.id !== id);
  savePlannings(all);
};

// --- Init Mock Data if empty or needs update ---
export const initMockData = () => {
  // 0. Ensure Roles exist
  if (!fallbackGet(STORAGE_KEYS.ROLES)) {
      saveRoles(STANDARD_ROLES.filter(r => r !== 'GÉNÉRAL').map(r => ({ id: r, label: r })));
  }

  let existingEmps = getEmployees();
  
  // 1. Init Employees if empty or old demo data
  const needsInitEmps = existingEmps.length === 0 || existingEmps.some(e => e.name === 'Jean Dupont');

  if (needsInitEmps) {
    const rawData = [
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

    existingEmps = rawData.map((d, i) => ({
      id: `emp_${i + 1}`,
      name: d.name,
      role: d.role,
      isActive: true,
      weeklyDefault: {} 
    }));
    
    saveEmployees(existingEmps);
  }

  // 2. Init Templates (Force Update to ensure IDs and colors match requirements)
  let templates: Template[] = [];
  const add = (role: string, name: string, serviceType: ShiftServiceType, slots: {start:string, end:string}[], color: string) => {
    // Generate deterministic ID based on role and name to avoid duplicates on re-init
    // Simple hash for demo purposes, or just random if not strict
    const id = `${role}-${name}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(); 
    templates.push({
      id: id,
      name,
      role,
      serviceType,
      slots,
      color
    });
  };

  // Palette colors
  const C_MIDI = '#fed7aa'; // Orange
  const C_SOIR = '#c7d2fe'; // Indigo
  const C_COUPURE = '#bae6fd'; // Blue
  const C_OUV = '#bbf7d0'; // Green
  const C_FERM = '#fbcfe8'; // Pink
  const C_DIR = '#ddd6fe'; // Violet
  const C_PLAGE = '#fde68a'; // Yellow

  // --- POSTE ACCUEIL ---
  add('ACCUEIL', 'Coupure', 'midi+soir', [{start: '10:00', end: '15:00'}, {start: '18:30', end: '23:00'}], C_COUPURE);
  add('ACCUEIL', 'Midi', 'midi', [{start: '10:00', end: '18:00'}], C_MIDI);
  add('ACCUEIL', 'Soir', 'soir', [{start: '16:30', end: '23:00'}], C_SOIR);

  // --- POSTE BARMAN ---
  add('BARMAN', 'Fermeture', 'soir', [{start: '17:00', end: '23:30'}], C_FERM);
  add('BARMAN', 'Midi', 'midi', [{start: '10:00', end: '11:00'}, {start: '11:45', end: '16:30'}], C_MIDI);
  add('BARMAN', 'Ouverture-coupure', 'midi+soir', [{start: '09:00', end: '14:30'}, {start: '18:00', end: '23:30'}], C_OUV);

  // --- POSTE CHEF DE RANG ---
  add('CHEF DE RANG', 'Coupure', 'midi+soir', [{start: '11:45', end: '15:00'}, {start: '19:00', end: '00:00'}], C_COUPURE);
  add('CHEF DE RANG', 'Fermeture', 'soir', [{start: '17:00', end: '00:00'}], C_FERM);
  add('CHEF DE RANG', 'Midi', 'midi', [{start: '11:45', end: '18:00'}], C_MIDI);
  add('CHEF DE RANG', 'Ouverture', 'midi', [{start: '09:00', end: '17:00'}], C_OUV);

  // --- POSTE DIRECTION + MANAGERS ---
  ['ENCADREMENT', 'MANAGERS'].forEach(role => {
      add(role, 'Direction', 'midi', [{start: '10:00', end: '19:00'}], C_DIR);
      add(role, 'Fermeture', 'soir', [{start: '16:30', end: '01:00'}], C_FERM);
      add(role, 'Midi', 'midi+soir', [{start: '11:45', end: '22:00'}], C_MIDI); 
      add(role, 'Ouverture', 'midi', [{start: '09:00', end: '17:00'}], C_OUV);
  });

  // --- POSTE PLAGE ---
  const PLAGE_ROLE = 'PLAGE / RUNNER';
  add(PLAGE_ROLE, '11h-21h30', 'midi+soir', [{start: '11:00', end: '21:30'}], C_PLAGE);
  add(PLAGE_ROLE, '11h-23h30', 'midi+soir', [{start: '11:00', end: '23:30'}], C_PLAGE);
  add(PLAGE_ROLE, '16h-00h30', 'soir', [{start: '16:00', end: '00:30'}], C_SOIR);
  add(PLAGE_ROLE, '16h-23h30', 'soir', [{start: '16:00', end: '23:30'}], C_SOIR);
  add(PLAGE_ROLE, '17h-00h', 'soir', [{start: '17:00', end: '00:00'}], C_SOIR);

  // --- POSTE RUNNER ---
  add('RUNNER', 'Coupure', 'midi+soir', [{start: '11:45', end: '15:00'}, {start: '19:00', end: '00:00'}], C_COUPURE);
  add('RUNNER', 'Fermeture', 'soir', [{start: '17:00', end: '00:00'}], C_FERM);
  add('RUNNER', 'Ouverture', 'midi', [{start: '09:00', end: '17:00'}], C_OUV);

  // Save templates to Storage
  saveTemplates(templates);

  // 3. APPLY WEEKLY DEFAULTS (Migration)
  // This map matches names to template names
  const defaultMap: Record<string, (string | null)[]> = {
      // ACCUEIL
      "KROTN SHEILHANE": ["REPOS", "REPOS", "Coupure", "Coupure", "Midi", "Soir", "Soir"],
      "HESLOT EMENI": ["Coupure", "Coupure", "REPOS", "REPOS", "Soir", "Midi", "Midi"],
      "DRIDI SARAH": [null, null, null, null, null, null, null],
      
      // CHEF DE RANG
      "MAGASSA MODY": ["REPOS", "Coupure", "Ouverture", "Ouverture", "Fermeture", "Fermeture", "REPOS"],
      "BARUA SHUVA": ["REPOS", "REPOS", "Coupure", "Ouverture", "Fermeture", "Coupure", "Midi"],
      "POLLET SAMANTHA": [null, null, null, null, null, null, null],
      "NDRI ABRAHAM": ["Coupure", "REPOS", "REPOS", "Ouverture", "Coupure", "Fermeture", "Fermeture"],
      "TAJUDDIN HASIM": [null, null, "REPOS", "REPOS", "Coupure", "Coupure", "Coupure"],
      "LIN CHLOE": ["Ouverture", "Fermeture", "REPOS", "REPOS", null, "Ouverture", "Midi"],
      "LAMINE MOHAMED": ["Coupure", "Coupure", "Coupure", "REPOS", "REPOS", "Ouverture", "Ouverture"],
      "KONATE IBRAHIMA": ["Fermeture", "REPOS", "REPOS", "Ouverture", "Coupure", "Coupure", "Midi"],
      "PENIN MAGALI": ["Ouverture", "Ouverture", "Coupure", "Ouverture", "Ouverture", "REPOS", "REPOS"],
      "BARUA SAGAR": ["REPOS", "REPOS", "Coupure", "Coupure", "Fermeture", "Coupure", "Fermeture"],

      // ENCADREMENT / MANAGERS
      "LOUISET FRANCOIS": ["REPOS", "Direction", "Direction", "Direction", "Direction", "Direction", "REPOS"],
      "SENG PHILIPPE": ["Ouverture", "REPOS", "REPOS", "Fermeture", "Fermeture", "Fermeture", "Midi"],
      "MINGUI REGIS": ["Fermeture", "Fermeture", "Fermeture", "REPOS", "REPOS", "Ouverture", "Ouverture"],
      "LEBIHAN MATTHEU": ["REPOS", "Ouverture", "Ouverture", "Ouverture", "Ouverture", "Fermeture", "REPOS"],
      "MANGANE LUCAS": ["REPOS", "REPOS", "Midi", "Fermeture", "Fermeture", "Fermeture", "Fermeture"],
  };

  const updatedEmployees = existingEmps.map(emp => {
      // Find matching config key (partial match to handle slight name variations)
      const configKey = Object.keys(defaultMap).find(k => 
          emp.name.toUpperCase().includes(k.toUpperCase()) || k.toUpperCase().includes(emp.name.toUpperCase())
      );
      
      if (configKey) {
          const defaults = defaultMap[configKey];
          const newWeeklyDefault: Record<string, string> = { ...(emp.weeklyDefault || {}) };
          let hasChanges = false;

          defaults.forEach((val, dayIndex) => {
              if (val === null) return;
              
              // Only update if not already set or we want to enforce the migration
              const key = dayIndex.toString();
              let newValue = '';

              if (val === "REPOS") {
                  newValue = 'repos';
              } else {
                  // Find template
                  const tpl = templates.find(t => 
                      t.name.toLowerCase() === val.toLowerCase() && 
                      (t.role === emp.role || t.role === 'GÉNÉRAL' || 
                       (['ENCADREMENT', 'MANAGERS'].includes(emp.role) && ['ENCADREMENT', 'MANAGERS'].includes(t.role)))
                  );
                  if (tpl) {
                      newValue = tpl.id;
                  }
              }

              if (newValue && newWeeklyDefault[key] !== newValue) {
                  newWeeklyDefault[key] = newValue;
                  hasChanges = true;
              }
          });
          
          if (hasChanges) {
             return { ...emp, weeklyDefault: newWeeklyDefault };
          }
      }
      return emp;
  });

  saveEmployees(updatedEmployees);
};