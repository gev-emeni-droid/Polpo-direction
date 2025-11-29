PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'0000_reset.sql','2025-11-27 19:18:58');
INSERT INTO "d1_migrations" VALUES(2,'0001_init.sql','2025-11-27 19:18:59');
INSERT INTO "d1_migrations" VALUES(3,'0001_initial_schema.sql','2025-11-27 19:19:00');
INSERT INTO "d1_migrations" VALUES(4,'0002_add_templates_and_defaults.sql','2025-11-27 19:19:00');
INSERT INTO "d1_migrations" VALUES(5,'0002_seed_data.sql','2025-11-27 19:19:00');
INSERT INTO "d1_migrations" VALUES(6,'0003_add_plannings.sql','2025-11-27 19:19:01');
CREATE TABLE roles (
    id TEXT PRIMARY KEY, 
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    header_bg_color TEXT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "roles" VALUES('550e8400-e29b-41d4-a716-446655440001','MANAGERS','managers',1,'#dc2626',1,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "roles" VALUES('550e8400-e29b-41d4-a716-446655440002','ACCUEIL','accueil',2,'#2563eb',1,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "roles" VALUES('550e8400-e29b-41d4-a716-446655440003','BAR','bar',3,'#7c3aed',1,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "roles" VALUES('550e8400-e29b-41d4-a716-446655440004','RUNNER','runner',4,'#059669',1,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "roles" VALUES('550e8400-e29b-41d4-a716-446655440005','PLAGE','plage',5,'#0891b2',1,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "roles" VALUES('550e8400-e29b-41d4-a716-446655440006','CUISINE','cuisine',6,'#ea580c',1,'2025-11-27 19:19:00','2025-11-27 19:19:00');
CREATE TABLE employees (
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
, weekly_default_json TEXT DEFAULT '{}');
CREATE TABLE shift_codes (
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
INSERT INTO "shift_codes" VALUES('AM','Matin','#22c55e','11:30','15:00','18:30','22:00',0,0,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "shift_codes" VALUES('AA','Après-midi','#3b82f6',NULL,NULL,'15:00','18:30',0,0,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "shift_codes" VALUES('CP','Congés Payés','#f59e0b',NULL,NULL,NULL,NULL,1,0,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "shift_codes" VALUES('REPOS','Repos','#6b7280',NULL,NULL,NULL,NULL,0,1,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "shift_codes" VALUES('MAL','Maladie','#ef4444',NULL,NULL,NULL,NULL,1,0,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "shift_codes" VALUES('RTT','RTT','#8b5cf6',NULL,NULL,NULL,NULL,1,0,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "shift_codes" VALUES('F','Formation','#06b6d4',NULL,NULL,NULL,NULL,1,0,'2025-11-27 19:19:00','2025-11-27 19:19:00');
INSERT INTO "shift_codes" VALUES('DIV','Divers','#a855f7',NULL,NULL,NULL,NULL,1,0,'2025-11-27 19:19:00','2025-11-27 19:19:00');
CREATE TABLE shifts (
    id TEXT PRIMARY KEY, 
    employee_id TEXT NOT NULL REFERENCES employees(id),
    date TEXT NOT NULL, 
    role_id TEXT NULL REFERENCES roles(id),
    notes TEXT NULL,
    created_by TEXT NULL,
    updated_by TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);
CREATE TABLE shift_segments (
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
CREATE TABLE absences (
    id TEXT PRIMARY KEY, 
    employee_id TEXT NOT NULL REFERENCES employees(id),
    start_date TEXT NOT NULL, 
    end_date TEXT NOT NULL, 
    code TEXT NOT NULL REFERENCES shift_codes(code),
    notes TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE settings (
    scope TEXT NOT NULL DEFAULT 'global',
    key TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT '{}',
    updated_by TEXT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(scope, key)
);
INSERT INTO "settings" VALUES('global','pdf_export','{"generate_from_roles": true, "include_weekends": false, "format": "A4"}','system','2025-11-27 19:19:00');
INSERT INTO "settings" VALUES('global','planning_view','{"default_view": "week", "start_day": "monday", "show_weekends": false}','system','2025-11-27 19:19:00');
INSERT INTO "settings" VALUES('global','colors','{"primary": "#2563eb", "secondary": "#64748b", "success": "#22c55e", "warning": "#f59e0b", "error": "#ef4444"}','system','2025-11-27 19:19:00');
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY, 
    actor TEXT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NULL,
    action TEXT NOT NULL,
    payload_json TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE users (
    id TEXT PRIMARY KEY, 
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE shift_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role_id TEXT REFERENCES roles(id), 
    service_type TEXT, 
    color TEXT,
    slots_json TEXT, 
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE plannings (
    id TEXT PRIMARY KEY,
    week_start TEXT NOT NULL, 
    week_end TEXT NOT NULL,   
    service TEXT NOT NULL,    
    status TEXT DEFAULT 'active', 
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(week_start, service)
);
INSERT INTO "plannings" VALUES('77026e8d-42f4-48bc-9d51-58964cfdc706','2024-12-02','2024-12-08','Salle','active','2025-11-27 19:39:02','2025-11-27 19:39:02');
INSERT INTO "plannings" VALUES('812d449d-b041-4300-b2b9-4b0ccdd236c9','2025-12-08','2025-12-14','Salle','active','2025-11-27 21:09:23','2025-11-27 21:09:23');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',6);
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_shifts_role_date ON shifts(role_id, date);
CREATE INDEX idx_shift_segments_shift ON shift_segments(shift_id);
CREATE INDEX idx_employees_role ON employees(role_id);
CREATE INDEX idx_absences_employee_start ON absences(employee_id, start_date);
CREATE INDEX idx_roles_sort_order ON roles(sort_order);
CREATE INDEX idx_shift_codes_is_absence ON shift_codes(is_absence);
CREATE INDEX idx_settings_scope ON settings(scope);
