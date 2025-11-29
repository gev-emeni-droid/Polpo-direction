SELECT 'DROP TRIGGER IF EXISTS "' || name || '";' AS sql
FROM sqlite_master
WHERE type='trigger' AND name NOT LIKE 'sqlite_%'
UNION ALL
SELECT 'DROP VIEW IF EXISTS "' || name || '";'
FROM sqlite_master
WHERE type='view' AND name NOT LIKE 'sqlite_%'
UNION ALL
SELECT 'DROP TABLE IF EXISTS "' || name || '";'
FROM sqlite_master
WHERE type='table' AND name NOT LIKE 'sqlite_%'
ORDER BY sql;
