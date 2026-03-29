
import { Employee, Planning, Template, ShiftServiceType, ShiftSegment, ShiftType, LongAbsence } from '../types';
import { addDays, format, parseISO, startOfWeek, endOfWeek, isBefore, startOfDay, getDay } from 'date-fns';
import * as api from './api';

// --- ROLES ---

export const getRoles = async () => {
  const roles = await api.listRoles();

  // Get blacklist to prevent resurrection of deleted roles
  const blacklist = await getDeletedRolesBlacklist();
  const blacklistSet = new Set(blacklist);

  // Source of truth: only roles configured in settings/API order.
  const filtered = Array.isArray(roles) ? roles.filter(r => !blacklistSet.has(r.id)) : [];

  // Business rule: ENCADREMENT must always exist in role management.
  if (!filtered.some(r => r.id === 'ENCADREMENT')) {
    filtered.unshift({ id: 'ENCADREMENT', label: 'ENCADREMENT' });
  }

  return filtered;
};

export const saveRoles = async (roles: { id: string, label: string }[]) => {
  // IMPORTANT: To preserve the drag & drop order,
  // we save the entire list as a single operation
  try {
    await api.saveRolesOrder(roles);
  } catch (err) {
    console.error('Failed to save roles order:', err);
    throw err;
  }
};

export const addRole = async (label: string) => {
  const roles = await getRoles();
  const roleId = label.trim();  // Use label as ID directly - no transformation
  if (roles.find((r: any) => r.id === roleId)) return;

  await api.saveRole({ id: roleId, label });

  // Remove from blacklist in case it was previously deleted
  await removeRoleFromBlacklist(roleId);

  // Cascade Update: Update any employees using this role (in case they were using it before it was officially added)
  const employees = await getEmployees();
  const employeeUpdates = employees
    .filter(e => e.role === roleId)
    .map(e => api.saveEmployee({ ...e, role: roleId }));
  if (employeeUpdates.length > 0) {
    await Promise.all(employeeUpdates);
  }

  // Cascade Update: Update any templates using this role
  const templates = await getTemplates();
  const templateUpdates = templates
    .filter(t => t.role === roleId)
    .map(t => api.saveTemplate({ ...t, role: roleId }));
  if (templateUpdates.length > 0) {
    await Promise.all(templateUpdates);
  }

  // Note: No need to update plannings for new roles since they wouldn't exist yet
  // Plannings will use the new role when employees are assigned to it
};

// Blacklist management for deleted roles
const BLACKLIST_KEY = 'deleted_roles_blacklist';

async function getDeletedRolesBlacklist(): Promise<string[]> {
  try {
    const value = await api.getSetting(BLACKLIST_KEY);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function addRoleToBlacklist(roleId: string): Promise<void> {
  const blacklist = await getDeletedRolesBlacklist();
  if (!blacklist.includes(roleId)) {
    blacklist.push(roleId);
    await api.setSetting(BLACKLIST_KEY, blacklist);
  }
}

async function removeRoleFromBlacklist(roleId: string): Promise<void> {
  const blacklist = await getDeletedRolesBlacklist();
  const updated = blacklist.filter(id => id !== roleId);
  if (updated.length !== blacklist.length) {
    await api.setSetting(BLACKLIST_KEY, updated);
  }
}

export const updateRole = async (id: string, newLabel: string) => {
  // Direct Upsert/Update: Bypass getRole check to ensure robustness
  await api.saveRole({ id, label: newLabel });
};

export const saveRole = async (role: { id: string, label: string }) => {
  return await api.saveRole(role);
};

export const deleteRole = async (id: string, reassignRoleId?: string) => {
  await api.deleteRole(id);

  // Add to blacklist so it doesn't reappear via auto-discovery
  await addRoleToBlacklist(id);

  // Delete all templates for this role (parallel) - with normalized matching
  const templates = await getTemplates();
  const normalizedId = id.toLowerCase().trim();
  const templatesForRole = templates.filter(t => t.role === id || t.role.toLowerCase().trim() === normalizedId);
  if (templatesForRole.length > 0) {
    await Promise.all(templatesForRole.map(t => api.deleteTemplate(t.id)));
  }

  if (reassignRoleId) {
    // Reassign Employees (parallel) - with normalized matching
    const employees = await getEmployees();
    const employeesToReassign = employees.filter(e => e.role === id || e.role.toLowerCase().trim() === normalizedId);
    if (employeesToReassign.length > 0) {
      await Promise.all(employeesToReassign.map(e => api.saveEmployee({ ...e, role: reassignRoleId })));
    }

    // Update active plannings to reflect the role change immediately
    const plannings = await getPlannings();
    const updates = plannings.map(async (p) => {
      // Skip archived to save time/bandwidth
      if (p.status === 'archived') return;

      let changed = false;
      const newRows = p.rows.map(row => {
        if (row.employeeRole === id || row.employeeRole.toLowerCase().trim() === normalizedId) {
          changed = true;
          return { ...row, employeeRole: reassignRoleId };
        }
        return row;
      });

      if (changed) {
        await api.savePlanning({ ...p, rows: newRows });
      }
    });
    await Promise.all(updates);
  } else {
    // Even if we think it's unused, force a cleanup to prevent resurrection
    // This handles cases where case-sensitivity or whitespace might have hidden the usage
    const employees = await getEmployees();
    const stragglers = employees.filter(e => e.role === id || e.role.toLowerCase().trim() === normalizedId);

    if (stragglers.length > 0) {
      // Reassign stragglers to "AUCUN" or empty to indicate no role
      const fallbackRole = "";
      await Promise.all(stragglers.map(e => api.saveEmployee({ ...e, role: fallbackRole })));
    }

    // Determine planning rows to clean up
    const plannings = await getPlannings();
    const cleanupUpdates = plannings.map(async (p) => {
      if (p.status === 'archived') return;
      if (!p.rows || !Array.isArray(p.rows)) return;

      let changed = false;
      // HARD DELETE: Filter out rows belonging to the deleted role
      const newRows = p.rows.filter(row => {
        const match = row.employeeRole === id || row.employeeRole.toLowerCase().trim() === normalizedId;
        if (match) {
          changed = true;
          return false; // Remove!
        }
        return true;
      });

      if (changed) {
        await api.savePlanning({ ...p, rows: newRows });
      }
    });

    // Cleanup Templates preventing resurrection
    const templates = await getTemplates();
    const templatesToDelete = templates.filter(t => t.role === id || t.role.toLowerCase().trim() === normalizedId);
    if (templatesToDelete.length > 0) {
      await Promise.all(templatesToDelete.map(t => api.deleteTemplate(t.id)));
    }

    if (cleanupUpdates.length > 0) {
      await Promise.all(cleanupUpdates);
    }

    // ACTUALLY DELETE: Remove from DB and blacklist to prevent auto-discovery resurrection
    await api.deleteRole(id);
    await addRoleToBlacklist(id);
  }
};

// --- EMPLOYEES ---

// --- EMPLOYEES ---

export const getEmployees = async (): Promise<Employee[]> => {
  const employees = await api.listEmployees();
  if (!Array.isArray(employees)) return [];

  // Sanitization on read
  return employees.map(e => {
    if (e.role === "ENCADREMENT /" || e.role.trim() === "ENCADREMENT /") {
      return { ...e, role: "ENCADREMENT" };
    }
    return e;
  });
};

export const saveEmployees = async (employees: Employee[]) => {
  // Sanitization on write
  for (const emp of employees) {
    const sanitized = { ...emp };
    if (sanitized.role === "ENCADREMENT /" || sanitized.role.trim() === "ENCADREMENT /") {
      sanitized.role = "ENCADREMENT";
    }
    await api.saveEmployee(sanitized);
  }
};

export const deleteEmployee = async (id: string) => {
  // Get employee being deleted to find their name
  const employeeToDelete = await api.getEmployee(id);
  if (!employeeToDelete) return;

  // Get all employees to find similar names (case-insensitive, ignoring spaces and special chars)
  const allEmployees = await getEmployees();
  const normalizeName = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');

  const duplicateIds = allEmployees
    .filter(e => normalizeName(e.name) === normalizeName(employeeToDelete.name))
    .map(e => e.id);

  // Delete ALL employees with similar names
  for (const empId of duplicateIds) {
    await api.deleteEmployee(empId);
  }

  // Cascade: Remove ALL employees with this name pattern from ALL plannings
  const plannings = await getPlannings();
  const planningUpdates = [];

  for (const p of plannings) {
    if (p.status === 'archived') continue;

    const originalRowCount = p.rows.length;
    const newRows = p.rows.filter(row =>
      !duplicateIds.includes(row.employeeId) &&
      normalizeName(row.employeeName) !== normalizeName(employeeToDelete.name)
    );

    // Only update if rows were actually removed
    if (newRows.length < originalRowCount) {
      planningUpdates.push(api.savePlanning({ ...p, rows: newRows }));
    }
  }

  if (planningUpdates.length > 0) {
    await Promise.all(planningUpdates);
  }
};

export const updateEmployeeDetails = async (id: string, name: string, role: string) => {
  // 1. Update Global Employee List
  const employee = await api.getEmployee(id);
  if (employee) {
    await api.saveEmployee({ ...employee, name, role });
  }

  // 2. Cascade Update to ALL Plannings (Rows)
  const plannings = await getPlannings();
  for (const p of plannings) {
    if (p.status === 'archived') continue;

    const rowIdx = p.rows.findIndex(r => r.employeeId === id);
    if (rowIdx !== -1) {
      const updatedRows = [...p.rows];
      updatedRows[rowIdx] = {
        ...updatedRows[rowIdx],
        employeeName: name,
        employeeRole: role
      };
      await api.savePlanning({ ...p, rows: updatedRows });
    }
  }
};

// --- WEEKLY DEFAULTS PROPAGATION ---
export const updateEmployeeWeeklyDefault = async (empId: string, dayIndex: string, tplId: string) => {
  // 1. Update Employee config
  const employee = await api.getEmployee(empId);
  if (!employee) return;

  const newDefaults = { ...(employee.weeklyDefault || {}) };
  if (tplId === 'repos' || !tplId) {
    newDefaults[dayIndex] = 'repos';
  } else {
    newDefaults[dayIndex] = tplId;
  }

  await api.saveEmployee({ ...employee, weeklyDefault: newDefaults });

  // 2. Propagate to Plannings
  const plannings = await getPlannings();
  const templates = await getTemplates();

  for (const p of plannings) {
    // Only update active plannings
    if (p.status !== 'active') continue;

    const rowIdx = p.rows.findIndex(r => r.employeeId === empId);
    if (rowIdx === -1) continue;

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
          // Recalculate serviceType based on actual slot times
          const firstStart = tpl.slots[0]?.start;
          const lastEnd = tpl.slots[tpl.slots.length - 1]?.end;
          if (firstStart) {
            if (firstStart < "12:00") {
              serviceType = lastEnd && lastEnd > "18:00" ? 'midi+soir' : 'midi';
            } else if (firstStart >= "16:00") {
              serviceType = 'soir';
            } else {
              serviceType = lastEnd && lastEnd > "18:00" ? 'soir' : 'midi';
            }
          }
          newSegments = tpl.slots.map(slot => ({
            type: 'horaire',
            start: slot.start,
            end: slot.end,
            templateId: tpl.id,
            color: tpl.color,
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

      const updatedRows = [...p.rows];
      updatedRows[rowIdx] = { ...row, shifts: newShifts };
      await api.savePlanning({ ...p, rows: updatedRows });
    }
  }
};

// --- TEMPLATES ---
export const getTemplates = async (): Promise<Template[]> => {
  return await api.listTemplates();
};

export const addTemplate = async (template: Template) => {
  return await api.saveTemplate(template);
};

export const saveTemplates = async (templates: Template[]) => {
  for (const t of templates) {
    await api.saveTemplate(t);
  }
};

export const updateTemplate = async (updated: Template) => {
  await api.saveTemplate(updated);

  // Cascade: Update segments in plannings (parallel)
  const plannings = await getPlannings();
  const planningUpdates = [];

  plannings.forEach(p => {
    if (p.status === 'archived') return;

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
              // Update color for segments using this template (if no manual override)
              newSegments.push({
                ...seg,
                color: updated.color
              });
              segChanged = true;
            } else {
              newSegments.push(seg);
            }
          });

          if (segChanged) {
            newShifts[date] = {
              ...shift,
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
      planningUpdates.push(api.savePlanning({ ...p, rows: newRows }));
    }
  });

  if (planningUpdates.length > 0) {
    await Promise.all(planningUpdates);
  }
};

export const deleteTemplate = async (id: string, reassignTplId?: string) => {
  await api.deleteTemplate(id);

  const employees = await getEmployees();
  const employeeUpdates = [];

  employees.forEach(emp => {
    if (!emp.weeklyDefault) return;
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
      employeeUpdates.push(api.saveEmployee({ ...emp, weeklyDefault: newDef }));
    }
  });

  if (employeeUpdates.length > 0) {
    await Promise.all(employeeUpdates);
  }
};

// --- LONG ABSENCES ---

export const getLongAbsences = async (): Promise<LongAbsence[]> => {
  return await api.listLongAbsences();
};

export const saveLongAbsences = async (absences: LongAbsence[]) => {
  for (const a of absences) {
    await api.saveLongAbsence(a);
  }
};

export const addLongAbsence = async (absence: Omit<LongAbsence, 'id'>) => {
  const newAbsence = { ...absence, id: crypto.randomUUID() };
  await api.saveLongAbsence(newAbsence);

  // Propagate to plannings (Apply Absence)
  await applyAbsenceRangeToPlannings(newAbsence);
};

export const deleteLongAbsence = async (id: string) => {
  const absence = await api.getLongAbsence(id);
  if (!absence) return;

  await api.deleteLongAbsence(id);

  // Propagate revert (Apply Default/Repos)
  await revertAbsenceRangeInPlannings(absence);
};

// Apply absence code to all affected days in all plannings
const applyAbsenceRangeToPlannings = async (absence: LongAbsence) => {
  const plannings = await getPlannings();

  for (const p of plannings) {
    // Skip archived if preferred, but usually we want consistency
    if (p.status === 'archived') continue;

    const rowIdx = p.rows.findIndex(r => r.employeeId === absence.employeeId);
    if (rowIdx === -1) continue;

    let rowChanged = false;
    const row = p.rows[rowIdx];
    const newShifts = { ...row.shifts };

    // Check if this week overlaps with absence
    if (absence.endDate < p.weekStart || absence.startDate > p.weekEnd) continue;

    // Iterate days of week
    for (let i = 0; i < 7; i++) {
      const current = addDays(parseISO(p.weekStart), i);
      const currentStr = format(current, 'yyyy-MM-dd');

      if (currentStr >= absence.startDate && currentStr <= absence.endDate) {
        // Check if the current day is already a rest day (repos)
        const existingShift = newShifts[currentStr];
        const isRestDay = !existingShift || existingShift.type === 'repos';
        
        // Don't apply absence on rest days - only on working days
        if (!isRestDay) {
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
    }

    if (rowChanged) {
      const updatedRows = [...p.rows];
      updatedRows[rowIdx] = { ...row, shifts: newShifts };
      await api.savePlanning({ ...p, rows: updatedRows });
    }
  }
};

// Revert absence: check weekly default for that day and apply it
const revertAbsenceRangeInPlannings = async (absence: LongAbsence) => {
  const plannings = await getPlannings();
  const employee = await api.getEmployee(absence.employeeId);
  const templates = await getTemplates();

  for (const p of plannings) {
    if (p.status === 'archived') continue;
    const rowIdx = p.rows.findIndex(r => r.employeeId === absence.employeeId);
    if (rowIdx === -1) continue;

    let rowChanged = false;
    const row = p.rows[rowIdx];
    const newShifts = { ...row.shifts };

    if (absence.endDate < p.weekStart || absence.startDate > p.weekEnd) continue;

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
            // Recalculate serviceType based on actual slot times
            const firstStart = tpl.slots[0]?.start;
            const lastEnd = tpl.slots[tpl.slots.length - 1]?.end;
            if (firstStart) {
              if (firstStart < "12:00") {
                serviceType = lastEnd && lastEnd > "18:00" ? 'midi+soir' : 'midi';
              } else if (firstStart >= "16:00") {
                serviceType = 'soir';
              } else {
                serviceType = lastEnd && lastEnd > "18:00" ? 'soir' : 'midi';
              }
            }
            newSegments = tpl.slots.map(slot => ({
              type: 'horaire',
              start: slot.start,
              end: slot.end,
              templateId: tpl.id,
              color: tpl.color,
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
      const updatedRows = [...p.rows];
      updatedRows[rowIdx] = { ...row, shifts: newShifts };
      await api.savePlanning({ ...p, rows: updatedRows });
    }
  }
};

// --- PLANNINGS ---

export const getPlannings = async (): Promise<Planning[]> => {
  let plannings = await api.listPlannings();

  // Filter out invalid plannings
  plannings = plannings.filter(p => p.weekStart && p.weekEnd && p.id);



  const today = startOfDay(new Date());
  let changed = false;

  // Archive old plannings
  for (const p of plannings) {
    if (!p.weekEnd) {
      console.warn('Planning missing weekEnd:', p);
      continue;
    }
    const weekEnd = parseISO(p.weekEnd);
    if (p.status === 'active' && isBefore(weekEnd, today)) {
      // Note: We are saving the potentially healed version here too, which is good
      await api.savePlanning({ ...p, status: 'archived' });
      changed = true;
    }
  }

  if (changed) {
    plannings = await api.listPlannings();
  }

  return plannings;
};

export const savePlannings = async (plannings: Planning[]) => {
  for (const p of plannings) {
    await api.savePlanning(p);
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
          const firstStart = tpl.slots[0]?.start;
          const lastEnd = tpl.slots[tpl.slots.length - 1]?.end;
          if (firstStart) {
            if (firstStart < "12:00") {
              shiftServiceType = lastEnd && lastEnd > "18:00" ? 'midi+soir' : 'midi';
            } else if (firstStart >= "16:00") {
              shiftServiceType = 'soir';
            } else {
              shiftServiceType = lastEnd && lastEnd > "18:00" ? 'soir' : 'midi';
            }
          }
          tpl.slots.forEach(slot => {
            segments.push({
              type: 'horaire',
              start: slot.start,
              end: slot.end,
              templateId: tpl.id,
              color: tpl.color,
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
  const current = await api.getPlanning(updated.id);
  if (current?.status === 'archived') {
    throw new Error('Ce planning est archivé et ne peut plus être modifié.');
  }

  await api.savePlanning(updated);
};

export const deletePlanning = async (id: string) => {
  await api.deletePlanning(id);
};

export const migrateLocalStorageToD1 = async () => {
  // No-op for now
  console.log('Migration skipped');
};

// --- THEME ---
const THEME_KEY = 'app_theme_color';
export const getTheme = async (): Promise<string> => {
  try {
    const val = await api.getSetting(THEME_KEY);
    return (typeof val === 'string' && val) ? val : '#4AA3A2'; // Default teal-ish
  } catch {
    return '#4AA3A2';
  }
};

export const saveTheme = async (color: string) => {
  await api.setSetting(THEME_KEY, color);
};

export const initMockData = async () => {
  // Désactivé : seed/mock data supprimé définitivement
  return;
};
