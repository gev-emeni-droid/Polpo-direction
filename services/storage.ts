
import { Employee, Planning, Template, STANDARD_ROLES, ShiftServiceType, ShiftSegment, ShiftType, LongAbsence } from '../types';
import { addDays, format, parseISO, startOfWeek, endOfWeek, isBefore, startOfDay, getDay } from 'date-fns';
import * as api from './api';

const STORAGE_KEYS = {
  EMPLOYEES: 'polpo_employees',
  TEMPLATES: 'polpo_templates',
  PLANNINGS: 'polpo_plannings',
  ROLES: 'polpo_roles',
  LONG_ABSENCES: 'polpo_long_absences'
};

// --- Cache for performance (NOT persistent) ---
let rolesCache: { id: string; label: string }[] | null = null;

export const getRoles = async () => {
  if (rolesCache) return rolesCache;
  
  const roles = await api.listRoles();
  if (Array.isArray(roles) && roles.length > 0) {
    rolesCache = roles;
    return roles;
  }
  
  // Fallback / Init from STANDARD_ROLES if empty
  const defaultRoles = STANDARD_ROLES.filter(r => r !== 'GÉNÉRAL').map(r => ({ id: r, label: r }));
  rolesCache = defaultRoles;
  
  // Try to save them
  for (const role of defaultRoles) {
    try {
      await api.saveRole(role);
    } catch (err) {
      console.error('Failed to initialize default role:', err);
    }
  }
  
  return defaultRoles;
};

export const saveRoles = async (roles: {id: string, label: string}[]) => {
    rolesCache = roles;
    // In practice, individual role saves are handled elsewhere
    // This is kept for backward compatibility
};

export const addRole = async (label: string) => {
    const roles = await getRoles();
    const newId = label.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    // Ensure uniqueness
    if (roles.find(r => r.id === newId)) return;
    
    await api.saveRole({ id: newId, label });
    rolesCache = [...roles, { id: newId, label }];
};

export const updateRole = async (id: string, newLabel: string) => {
    let roles = await getRoles();
    const roleIndex = roles.findIndex(r => r.id === id);
    if (roleIndex === -1) return;
    
    const oldLabel = roles[roleIndex].label;
    roles[roleIndex].label = newLabel;
    await api.saveRole({ id, label: newLabel });
    rolesCache = roles;

    // Cascade Update: Employees
    const employees = await getEmployees();
    const updatedEmps = employees.map(e => {
        if (e.role === id || e.role === oldLabel) return { ...e, role: id };
        return e;
    });
    await saveEmployees(updatedEmps);

    // Cascade Update: Templates
    const templates = await getTemplates();
    const updatedTpls = templates.map(t => {
        if (t.role === id || t.role === oldLabel) return { ...t, role: id };
        return t;
    });
    await saveTemplates(updatedTpls);
};

export const deleteRole = async (id: string, reassignRoleId?: string) => {
    let roles = await getRoles();
    roles = roles.filter(r => r.id !== id);
    await api.deleteRole(id);
    rolesCache = roles;

    if (reassignRoleId) {
        // Reassign Employees
        const employees = await getEmployees();
        const updatedEmps = employees.map(e => {
            if (e.role === id) return { ...e, role: reassignRoleId };
            return e;
        });
        await saveEmployees(updatedEmps);

        // Reassign Templates
        const templates = await getTemplates();
        const updatedTpls = templates.map(t => {
            if (t.role === id) return { ...t, role: reassignRoleId };
            return t;
        });
        await saveTemplates(updatedTpls);
    }
};

export const getEmployees = async (): Promise<Employee[]> => {
  const employees = await api.listEmployees();
  return Array.isArray(employees) ? employees : [];
};

export const saveEmployees = async (employees: Employee[]) => {
  // Save all employees one by one
  for (const emp of employees) {
    try {
      await api.saveEmployee(emp);
    } catch (err) {
      console.error('Failed to save employee:', err);
    }
  }
};

export const updateEmployeeDetails = async (id: string, name: string, role: string) => {
    // 1. Update Global Employee List
    const employees = await getEmployees();
    const idx = employees.findIndex(e => e.id === id);
    if (idx !== -1) {
        employees[idx] = { ...employees[idx], name, role };
        await api.saveEmployee(employees[idx]);
    }

    // 2. Cascade Update to ALL Plannings (Rows)
    const plannings = await getPlannings();
    let changed = false;
    const updatedPlannings = plannings.map(p => {
        const rowIdx = p.rows.findIndex(r => r.employeeId === id);
        if (rowIdx !== -1) {
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
        await savePlannings(updatedPlannings);
    }
};

// --- WEEKLY DEFAULTS PROPAGATION ---
export const updateEmployeeWeeklyDefault = async (empId: string, dayIndex: string, tplId: string) => {
  // 1. Update Employee config
  const employees = await getEmployees();
  const empIdx = employees.findIndex(e => e.id === empId);
  if (empIdx === -1) return;

  const newDefaults = { ...(employees[empIdx].weeklyDefault || {}) };
  if (tplId === 'repos' || !tplId) {
      newDefaults[dayIndex] = 'repos';
  } else {
      newDefaults[dayIndex] = tplId;
  }
  
  employees[empIdx] = { ...employees[empIdx], weeklyDefault: newDefaults };
  await api.saveEmployee(employees[empIdx]);

  // 2. Propagate to Plannings
  const plannings = await getPlannings();
  const templates = await getTemplates();
  let changed = false;

  const updatedPlannings = plannings.map(p => {
      // Only update active plannings
      if (p.status !== 'active') return p;

      const rowIdx = p.rows.findIndex(r => r.employeeId === empId);
      if (rowIdx === -1) return p;

      const row = p.rows[rowIdx];
      const newShifts = { ...row.shifts };
      const start = parseISO(p.weekStart);
      
      const targetDate = addDays(start, parseInt(dayIndex));
      const targetDateStr = format(targetDate, 'yyyy-MM-dd');

      const existingShift = newShifts[targetDateStr];
      const hasManualOverride = existingShift?.segments?.some(s => s.hasOverride);

      if (!hasManualOverride) {
          // Apply new default
          let newSegments: ShiftSegment[] = [];
          let serviceType: ShiftServiceType = 'none';
          let type: ShiftType = 'repos';

          if (tplId && tplId !== 'repos') {
              const tpl = templates.find(t => t.id === tplId);
              if (tpl) {
                  type = 'travail';
                  serviceType = tpl.serviceType;
                  newSegments = tpl.slots.map(slot => ({
                      type: 'horaire',
                      start: slot.start,
                      end: slot.end,
                      templateId: tpl.id,
                      hasOverride: false
                  }));
              } else {
                   newSegments = [{ type: 'code', label: 'REPOS' }];
              }
          } else {
              type = 'repos';
              newSegments = [{ type: 'code', label: 'REPOS' }];
          }

          newShifts[targetDateStr] = {
              date: targetDateStr,
              type,
              serviceType,
              segments: newSegments
          };
          
          p.rows[rowIdx] = { ...row, shifts: newShifts };
          changed = true;
      }

      return p;
  });

  if (changed) {
      await savePlannings(updatedPlannings);
  }
};

// --- TEMPLATES ---
export const getTemplates = async (): Promise<Template[]> => {
  const templates = await api.listTemplates();
  return Array.isArray(templates) ? templates : [];
};

export const saveTemplates = async (templates: Template[]) => {
  for (const tpl of templates) {
    try {
      await api.saveTemplate(tpl);
    } catch (err) {
      console.error('Failed to save template:', err);
    }
  }
};

export const updateTemplate = async (updated: Template) => {
    const templates = await getTemplates();
    const idx = templates.findIndex(t => t.id === updated.id);
    if (idx === -1) return;
    
    await api.saveTemplate(updated);

    // Cascade: Update segments in plannings
    const plannings = await getPlannings();
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
                        if (seg.templateId === updated.id && !seg.hasOverride) {
                            segChanged = true;
                            updated.slots.forEach(slot => {
                                newSegments.push({
                                    type: 'horaire',
                                    start: slot.start,
                                    end: slot.end,
                                    templateId: updated.id,
                                    hasOverride: false
                                });
                            });
                        } else {
                            newSegments.push(seg);
                        }
                    });

                    if (segChanged) {
                        newSegments.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
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
        await savePlannings(newPlannings);
    }
};

export const deleteTemplate = async (id: string, reassignTplId?: string) => {
    let templates = await getTemplates();
    templates = templates.filter(t => t.id !== id);
    await api.deleteTemplate(id);

    const employees = await getEmployees();
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
                    delete newDef[day]; 
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
        await saveEmployees(updatedEmps);
    }
};

// --- LONG ABSENCES ---

export const getLongAbsences = async (): Promise<LongAbsence[]> => {
    const absences = await api.listLongAbsences();
    return Array.isArray(absences) ? absences : [];
};

export const saveLongAbsences = async (absences: LongAbsence[]) => {
    for (const absence of absences) {
      try {
        await api.saveLongAbsence(absence);
      } catch (err) {
        console.error('Failed to save long absence:', err);
      }
    }
};

export const addLongAbsence = async (absence: Omit<LongAbsence, 'id'>) => {
    const newAbsence = { ...absence, id: crypto.randomUUID() };
    await api.saveLongAbsence(newAbsence);
    
    // Propagate to plannings (Apply Absence)
    await applyAbsenceRangeToPlannings(newAbsence);
};

export const deleteLongAbsence = async (id: string) => {
    const absences = await getLongAbsences();
    const target = absences.find(a => a.id === id);
    if (!target) return;

    await api.deleteLongAbsence(id);

    // Propagate revert (Apply Default/Repos)
    await revertAbsenceRangeInPlannings(target);
};

// Apply absence code to all affected days in all plannings
const applyAbsenceRangeToPlannings = async (absence: LongAbsence) => {
    const plannings = await getPlannings();
    let changed = false;

    const updatedPlannings = plannings.map(p => {
        // Skip archived if preferred, but usually we want consistency
        if (p.status === 'archived') return p;

        const rowIdx = p.rows.findIndex(r => r.employeeId === absence.employeeId);
        if (rowIdx === -1) return p;

        let rowChanged = false;
        const row = p.rows[rowIdx];
        const newShifts = { ...row.shifts };

        // Check if this week overlaps with absence
        if (absence.endDate < p.weekStart || absence.startDate > p.weekEnd) return p;

        // Iterate days of week
        for (let i = 0; i < 7; i++) {
            const current = addDays(parseISO(p.weekStart), i);
            const currentStr = format(current, 'yyyy-MM-dd');
            
            if (currentStr >= absence.startDate && currentStr <= absence.endDate) {
                // Apply Absence
                newShifts[currentStr] = {
                    date: currentStr,
                    type: 'absence',
                    serviceType: 'none',
                    segments: [{ type: 'code', label: absence.type }]
                };
                rowChanged = true;
            }
        }

        if (rowChanged) {
            changed = true;
            p.rows[rowIdx] = { ...row, shifts: newShifts };
        }
        return p;
    });

    if (changed) await savePlannings(updatedPlannings);
};

// Revert absence: check weekly default for that day and apply it
const revertAbsenceRangeInPlannings = async (absence: LongAbsence) => {
    const plannings = await getPlannings();
    const employees = await getEmployees();
    const templates = await getTemplates();
    const employee = employees.find(e => e.id === absence.employeeId);
    
    let changed = false;

    const updatedPlannings = plannings.map(p => {
        if (p.status === 'archived') return p;
        const rowIdx = p.rows.findIndex(r => r.employeeId === absence.employeeId);
        if (rowIdx === -1) return p;

        let rowChanged = false;
        const row = p.rows[rowIdx];
        const newShifts = { ...row.shifts };

        if (absence.endDate < p.weekStart || absence.startDate > p.weekEnd) return p;

        for (let i = 0; i < 7; i++) {
            const current = addDays(parseISO(p.weekStart), i);
            const currentStr = format(current, 'yyyy-MM-dd');
            
            if (currentStr >= absence.startDate && currentStr <= absence.endDate) {
                // Determine what to put back (Weekly Default)
                const dayOfWeek = getDay(current);
                const dayIndex = (dayOfWeek + 6) % 7; 
                
                const defaultTplId = employee?.weeklyDefault?.[dayIndex.toString()];
                
                let newSegments: ShiftSegment[] = [];
                let type: ShiftType = 'repos';
                let serviceType: ShiftServiceType = 'none';

                if (defaultTplId && defaultTplId !== 'repos') {
                    const tpl = templates.find(t => t.id === defaultTplId);
                    if (tpl) {
                        type = 'travail';
                        serviceType = tpl.serviceType;
                        newSegments = tpl.slots.map(slot => ({
                            type: 'horaire',
                            start: slot.start,
                            end: slot.end,
                            templateId: tpl.id,
                            hasOverride: false
                        }));
                    } else {
                        newSegments = [{ type: 'code', label: 'REPOS' }];
                    }
                } else {
                    newSegments = [{ type: 'code', label: 'REPOS' }];
                }

                newShifts[currentStr] = {
                    date: currentStr,
                    type,
                    serviceType,
                    segments: newSegments
                };
                rowChanged = true;
            }
        }

        if (rowChanged) {
            changed = true;
            p.rows[rowIdx] = { ...row, shifts: newShifts };
        }
        return p;
    });

    if (changed) await savePlannings(updatedPlannings);
};

// --- PLANNINGS ---

export const getPlannings = async (): Promise<Planning[]> => {
  const data = await api.listPlannings();
  let plannings: Planning[] = Array.isArray(data) ? data : [];

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
    await savePlannings(plannings);
  }

  return plannings;
};

export const savePlannings = async (plannings: Planning[]) => {
  for (const planning of plannings) {
    try {
      await api.savePlanning(planning);
    } catch (err) {
      console.error('Failed to save planning:', err);
    }
  }
};

export const createPlanning = async (inputDate: Date, service: 'Salle' | 'Cuisine'): Promise<Planning> => {
  const weekStart = startOfWeek(inputDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  
  const employees = (await getEmployees()).filter(e => e.isActive);
  const templates = await getTemplates();
  const longAbsences = await getLongAbsences();

  const newPlanning: Planning = {
    id: crypto.randomUUID(),
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    service,
    status: 'active',
    createdAt: Date.now(),
    rows: employees.map(emp => {
      const shifts: Record<string, any> = {};

      for (let i = 0; i < 7; i++) {
        const dateObj = addDays(weekStart, i);
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        
        // 1. Check Long Absence First
        const absence = longAbsences.find(a => a.employeeId === emp.id && dateStr >= a.startDate && dateStr <= a.endDate);

        if (absence) {
             shifts[dateStr] = {
                date: dateStr,
                type: 'absence',
                serviceType: 'none',
                segments: [{ type: 'code', label: absence.type }]
            };
            continue;
        }

        // 2. Weekly Default
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
                    templateId: tpl.id, 
                    hasOverride: false
                });
            });
        } else if (defaultTplId === 'repos') {
             shiftType = 'repos';
             segments.push({ type: 'code', label: 'REPOS' });
        } else {
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

  await api.savePlanning(newPlanning);
  return newPlanning;
};

export const updatePlanning = async (updated: Planning) => {
  await api.savePlanning(updated);
};

export const deletePlanning = async (id: string) => {
  await api.deletePlanning(id);
};

export const migrateLocalStorageToD1 = async () => {
  try {
    // Check if migration is already done
    const importDone = await api.getSetting('import_done');
    if (importDone === true) {
      return; // Already migrated
    }

    // Try to read legacy localStorage data (if running on a browser with old data)
    const legacyData: any = {};
    
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const roles = localStorage.getItem(STORAGE_KEYS.ROLES);
        const employees = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
        const templates = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
        const plannings = localStorage.getItem(STORAGE_KEYS.PLANNINGS);
        const absences = localStorage.getItem(STORAGE_KEYS.LONG_ABSENCES);

        if (roles) legacyData.roles = JSON.parse(roles);
        if (employees) legacyData.employees = JSON.parse(employees);
        if (templates) legacyData.templates = JSON.parse(templates);
        if (plannings) legacyData.plannings = JSON.parse(plannings);
        if (absences) legacyData.longAbsences = JSON.parse(absences);
      } catch (err) {
        console.error('Failed to read legacy localStorage:', err);
      }
    }

    // If we have data, migrate it
    if (Object.keys(legacyData).length > 0) {
      try {
        await api.performMigration(legacyData);
      } catch (err) {
        console.error('Migration to D1 failed:', err);
        throw err;
      }

      // Clear localStorage after successful migration
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
          });
        } catch (err) {
          console.error('Failed to clear localStorage:', err);
        }
      }
    }

    // Mark migration as done
    await api.setSetting('import_done', true);
  } catch (err) {
    console.error('Migration process failed:', err);
    throw err;
  }
};

export const initMockData = async () => {
  try {
    const roles = await getRoles();
    if (!roles || roles.length === 0) {
      // Initialize default roles
      const defaultRoles = STANDARD_ROLES.filter(r => r !== 'GÉNÉRAL').map(r => ({ id: r, label: r }));
      for (const role of defaultRoles) {
        try {
          await api.saveRole(role);
        } catch (err) {
          console.error('Failed to save default role:', err);
        }
      }
    }

    let existingEmps = await getEmployees();
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
      
      await saveEmployees(existingEmps);
    }

    // 2. Init Templates
    let templates: Template[] = [];
    const add = (role: string, name: string, serviceType: ShiftServiceType, slots: {start:string, end:string}[], color: string) => {
      const id = `${role}-${name}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(); 
      templates.push({ id, name, role, serviceType, slots, color });
    };

    const C_MIDI = '#fed7aa'; 
    const C_SOIR = '#c7d2fe'; 
    const C_COUPURE = '#bae6fd'; 
    const C_OUV = '#bbf7d0'; 
    const C_FERM = '#fbcfe8'; 
    const C_DIR = '#ddd6fe'; 
    const C_PLAGE = '#fde68a'; 

    add('ACCUEIL', 'Coupure', 'midi+soir', [{start: '10:00', end: '15:00'}, {start: '18:30', end: '23:00'}], C_COUPURE);
    add('ACCUEIL', 'Midi', 'midi', [{start: '10:00', end: '18:00'}], C_MIDI);
    add('ACCUEIL', 'Soir', 'soir', [{start: '16:30', end: '23:00'}], C_SOIR);

    add('BARMAN', 'Fermeture', 'soir', [{start: '17:00', end: '23:30'}], C_FERM);
    add('BARMAN', 'Midi', 'midi', [{start: '10:00', end: '11:00'}, {start: '11:45', end: '16:30'}], C_MIDI);
    add('BARMAN', 'Ouverture-coupure', 'midi+soir', [{start: '09:00', end: '14:30'}, {start: '18:00', end: '23:30'}], C_OUV);

    add('CHEF DE RANG', 'Coupure', 'midi+soir', [{start: '11:45', end: '15:00'}, {start: '19:00', end: '00:00'}], C_COUPURE);
    add('CHEF DE RANG', 'Fermeture', 'soir', [{start: '17:00', end: '00:00'}], C_FERM);
    add('CHEF DE RANG', 'Midi', 'midi', [{start: '11:45', end: '18:00'}], C_MIDI);
    add('CHEF DE RANG', 'Ouverture', 'midi', [{start: '09:00', end: '17:00'}], C_OUV);

    ['ENCADREMENT', 'MANAGERS'].forEach(role => {
        add(role, 'Direction', 'midi', [{start: '10:00', end: '19:00'}], C_DIR);
        add(role, 'Fermeture', 'soir', [{start: '16:30', end: '01:00'}], C_FERM);
        add(role, 'Midi', 'midi+soir', [{start: '11:45', end: '22:00'}], C_MIDI); 
        add(role, 'Ouverture', 'midi', [{start: '09:00', end: '17:00'}], C_OUV);
    });

    const PLAGE_ROLE = 'PLAGE / RUNNER';
    add(PLAGE_ROLE, '11h-21h30', 'midi+soir', [{start: '11:00', end: '21:30'}], C_PLAGE);
    add(PLAGE_ROLE, '11h-23h30', 'midi+soir', [{start: '11:00', end: '23:30'}], C_PLAGE);
    add(PLAGE_ROLE, '16h-00h30', 'soir', [{start: '16:00', end: '00:30'}], C_SOIR);
    add(PLAGE_ROLE, '16h-23h30', 'soir', [{start: '16:00', end: '23:30'}], C_SOIR);
    add(PLAGE_ROLE, '17h-00h', 'soir', [{start: '17:00', end: '00:00'}], C_SOIR);

    add('RUNNER', 'Coupure', 'midi+soir', [{start: '11:45', end: '15:00'}, {start: '19:00', end: '00:00'}], C_COUPURE);
    add('RUNNER', 'Fermeture', 'soir', [{start: '17:00', end: '00:00'}], C_FERM);
    add('RUNNER', 'Ouverture', 'midi', [{start: '09:00', end: '17:00'}], C_OUV);

    await saveTemplates(templates);

    const defaultMap: Record<string, (string | null)[]> = {
        "KROTN SHEILHANE": ["REPOS", "REPOS", "Coupure", "Coupure", "Midi", "Soir", "Soir"],
        "HESLOT EMENI": ["Coupure", "Coupure", "REPOS", "REPOS", "Soir", "Midi", "Midi"],
        "DRIDI SARAH": [null, null, null, null, null, null, null],
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
        "LOUISET FRANCOIS": ["REPOS", "Direction", "Direction", "Direction", "Direction", "Direction", "REPOS"],
        "SENG PHILIPPE": ["Ouverture", "REPOS", "REPOS", "Fermeture", "Fermeture", "Fermeture", "Midi"],
        "MINGUI REGIS": ["Fermeture", "Fermeture", "Fermeture", "REPOS", "REPOS", "Ouverture", "Ouverture"],
        "LEBIHAN MATTHEU": ["REPOS", "Ouverture", "Ouverture", "Ouverture", "Ouverture", "Fermeture", "REPOS"],
        "MANGANE LUCAS": ["REPOS", "REPOS", "Midi", "Fermeture", "Fermeture", "Fermeture", "Fermeture"],
    };

    const updatedEmployees = existingEmps.map(emp => {
        const configKey = Object.keys(defaultMap).find(k => 
            emp.name.toUpperCase().includes(k.toUpperCase()) || k.toUpperCase().includes(emp.name.toUpperCase())
        );
        
        if (configKey) {
            const defaults = defaultMap[configKey];
            const newWeeklyDefault: Record<string, string> = { ...(emp.weeklyDefault || {}) };
            let hasChanges = false;

            defaults.forEach((val, dayIndex) => {
                if (val === null) return;
                const key = dayIndex.toString();
                let newValue = '';

                if (val === "REPOS") {
                    newValue = 'repos';
                } else {
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

    await saveEmployees(updatedEmployees);
  } catch (err) {
    console.error('Mock data initialization failed:', err);
    throw err;
  }
};
