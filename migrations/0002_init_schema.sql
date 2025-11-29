-- Migration number: 0002 	 2025-11-27T21:37:15.351Z

-- Roles (postes)
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    header_bg_color TEXT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    display_name TEXT NULL,
    role_id TEXT NULL REFERENCES roles(id),
    status TEXT NOT NULL DEFAULT 'active',
    contract_hours_week INTEGER NULL,
    contract_type TEXT NULL,
    is_external INTEGER NOT NULL DEFAULT 0,
    external_category TEXT NULL,
    email TEXT NULL,
    phone TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Shift codes (AM/AA/CP/REPOS… + couleurs + heures par défaut)
CREATE TABLE IF NOT EXISTS shift_codes (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    default_color TEXT NULL,
    default_start_midi TEXT NULL,
    default_end_midi TEXT NULL,
    default_start_soir TEXT NULL,
    default_end_soir TEXT NULL,
    is_absence INTEGER NOT NULL DEFAULT 0,
    is_rest INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Shifts (1 employé + 1 date)
CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    date TEXT NOT NULL,
    role_id TEXT NULL REFERENCES roles(id),
    notes TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

-- Shift segments (midi/soir + overrides)
CREATE TABLE IF NOT EXISTS shift_segments (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    segment TEXT NOT NULL CHECK(segment IN ('midi','soir')),
    code TEXT NOT NULL REFERENCES shift_codes(code),
    label_override TEXT NULL,
    start_time TEXT NULL,
    end_time TEXT NULL,
    color_override TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shift_id, segment)
);

-- Absences
CREATE TABLE IF NOT EXISTS absences (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    code TEXT NOT NULL REFERENCES shift_codes(code),
    notes TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Settings (paramètres UI, export PDF, couleurs…)
CREATE TABLE IF NOT EXISTS settings (
    scope TEXT NOT NULL DEFAULT 'global',
    key TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(scope, key)
);

-- Audit log (recommandé)
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor TEXT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NULL,
    action TEXT NOT NULL,
    payload_json TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_employees_role_id ON employees(role_id);
CREATE INDEX IF NOT EXISTS idx_shift_segments_shift_id ON shift_segments(shift_id);
CREATE INDEX IF NOT EXISTS idx_absences_employee_id ON absences(employee_id);
CREATE INDEX IF NOT EXISTS idx_absences_dates ON absences(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
