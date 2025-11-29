-- Migration number: 0003 	 2025-11-27T22:15:00.000Z

-- Templates (modèles de shifts avec slots horaires)
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role_id TEXT NOT NULL REFERENCES roles(id),
    service_type TEXT NOT NULL CHECK(service_type IN ('midi','soir','midi+soir','none')),
    color TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Template slots (créneaux horaires d'un template)
CREATE TABLE IF NOT EXISTS template_slots (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Weekly defaults (planning hebdomadaire par employé)
CREATE TABLE IF NOT EXISTS weekly_defaults (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6), -- 0 = lundi
    template_id TEXT NULL REFERENCES templates(id),
    is_rest INTEGER NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, day_of_week)
);

-- Plannings (semaines de planning)
CREATE TABLE IF NOT EXISTS plannings (
    id TEXT PRIMARY KEY,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    service TEXT NOT NULL CHECK(service IN ('Salle','Cuisine')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(week_start, service)
);

-- Planning rows (lignes d'employés dans un planning)
CREATE TABLE IF NOT EXISTS planning_rows (
    id TEXT PRIMARY KEY,
    planning_id TEXT NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    employee_name TEXT NOT NULL,
    employee_role TEXT NOT NULL,
    is_extra INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(planning_id, employee_id)
);

-- Index pour les nouvelles tables
CREATE INDEX IF NOT EXISTS idx_templates_role_id ON templates(role_id);
CREATE INDEX IF NOT EXISTS idx_template_slots_template_id ON template_slots(template_id);
CREATE INDEX IF NOT EXISTS idx_weekly_defaults_employee_id ON weekly_defaults(employee_id);
CREATE INDEX IF NOT EXISTS idx_plannings_week_start ON plannings(week_start);
CREATE INDEX IF NOT EXISTS idx_planning_rows_planning_id ON planning_rows(planning_id);
CREATE INDEX IF NOT EXISTS idx_planning_rows_employee_id ON planning_rows(employee_id);
