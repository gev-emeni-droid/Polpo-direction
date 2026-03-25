
export type ServiceType = 'Salle' | 'Cuisine';
export type ShiftServiceType = 'midi' | 'soir' | 'midi+soir' | 'none';
export type ShiftType = 'travail' | 'repos' | 'absence';

export const ABSENCE_TYPES = [
  "Séléctionnez une ABS",
  "Ecole",
  "AA",
  "RN",
  "JF",
  "RJF",
  "AT",
  "AM",
  "CM",
  "SUSPENDU",
  "RCF",
  "CP",
] as const;

export interface TimeSlot {
  start: string;
  end: string;
}

export interface Template {
  id: string;
  name: string;
  role: string;
  serviceType: ShiftServiceType;
  slots: TimeSlot[];
  color?: string; // Hex code
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  weeklyDefault?: Record<string, string>;
  isActive: boolean;
}

export interface LongAbsence {
  id: string;
  employeeId: string;
  type: string; // From ABSENCE_TYPES
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface ShiftSegment {
  type: 'horaire' | 'code';
  start?: string; // HH:MM
  end?: string;   // HH:MM
  label?: string; // REPOS, AA, etc.
  templateId?: string; // Link to original template for coloring
  color?: string; // Color from template (auto-synced)
  colorOverride?: string; // Custom color for this specific segment instance
  hasOverride?: boolean;
  note?: string;
}

export interface Shift {
  date: string; // YYYY-MM-DD
  type: ShiftType; // General type for the day (computed or dominant)
  serviceType: ShiftServiceType;
  segments: ShiftSegment[];
}

export interface PlanningRow {
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  isExtra: boolean;
  shifts: Record<string, Shift>;
}

export interface ExtraShift {
  id: string;
  planningId?: string;
  label: "Hôtesse LBE" | "Brigad Plage" | "Agent de sécurité";
  date: string;
  start: string;
  end: string;
  count: number; // Number of extras
}

export interface Planning {
  id: string;
  weekStart: string;
  weekEnd: string;
  service: ServiceType;
  status: 'active' | 'archived';
  rows: PlanningRow[];
  extraShifts: ExtraShift[]; // For storing extras separately
  createdAt: number;
}
