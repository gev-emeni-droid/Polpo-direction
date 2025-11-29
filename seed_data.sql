-- Insert roles de base
INSERT OR IGNORE INTO roles (id, name, slug, sort_order, header_bg_color, is_active) VALUES
('MANAGERS', 'MANAGERS', 'managers', 1, '#ddd6fe', 1),
('ENCADREMENT', 'ENCADREMENT', 'encadrement', 2, '#ddd6fe', 1),
('COMMERCIALE + ADMIN', 'COMMERCIALE + ADMIN', 'commerciale-admin', 3, '#fbcfe8', 1),
('ACCUEIL', 'ACCUEIL', 'accueil', 4, '#fed7aa', 1),
('BARMAN', 'BARMAN', 'barman', 5, '#bae6fd', 1),
('CHEF DE RANG', 'CHEF DE RANG', 'chef-de-rang', 6, '#c7d2fe', 1),
('APPRENTI', 'APPRENTI', 'apprenti', 7, '#bbf7d0', 1),
('RUNNER', 'RUNNER', 'runner', 8, '#fde68a', 1),
('PLAGE / RUNNER', 'PLAGE / RUNNER', 'plage-runner', 9, '#fde68a', 1);

-- Insert shift codes de base
INSERT OR IGNORE INTO shift_codes (code, label, default_color, default_start_midi, default_end_midi, default_start_soir, default_end_soir, is_absence, is_rest) VALUES
('AM', 'AM', '#fed7aa', '10:00', '18:00', NULL, NULL, 0, 0),
('AA', 'AA', '#c7d2fe', NULL, NULL, '16:30', '23:00', 0, 0),
('CP', 'CP', '#bae6fd', '10:00', '15:00', '18:30', '23:00', 0, 0),
('OUV', 'OUV', '#bbf7d0', '09:00', '17:00', NULL, NULL, 0, 0),
('FERM', 'FERM', '#fbcfe8', NULL, NULL, '17:00', '23:30', 0, 0),
('DIR', 'DIR', '#ddd6fe', '10:00', '19:00', NULL, NULL, 0, 0),
('PLAGE', 'PLAGE', '#fde68a', '11:00', '21:30', NULL, NULL, 0, 0),
('REPOS', 'REPOS', '#e5e7eb', NULL, NULL, NULL, NULL, 0, 1),
('CP', 'CP', '#bae6fd', '10:00', '15:00', '18:30', '23:00', 0, 0),
('MAL', 'MAL', '#fca5a5', NULL, NULL, NULL, NULL, 1, 0),
('CONG', 'CONG', '#fbbf24', NULL, NULL, NULL, NULL, 1, 0),
('REFORME', 'REFORME', '#9ca3af', NULL, NULL, NULL, NULL, 1, 0);

-- Insert settings de base
INSERT OR IGNORE INTO settings (scope, key, value_json) VALUES
('global', 'export_pdf_roles', '{"enabled": true, "roles": ["MANAGERS", "ENCADREMENT", "COMMERCIALE + ADMIN", "ACCUEIL", "BARMAN", "CHEF DE RANG", "APPRENTI", "RUNNER", "PLAGE / RUNNER"]}'),
('global', 'ui_colors', '{"primary": "#3b82f6", "secondary": "#64748b", "success": "#10b981", "warning": "#f59e0b", "error": "#ef4444"}'),
('global', 'planning_view', '{"default_view": "week", "show_weekends": true, "start_hour": 8, "end_hour": 24}');
