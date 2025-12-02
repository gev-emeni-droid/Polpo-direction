export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only handle /api/* routes
  if (!pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Not an API route' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate D1 database exists
  const db = env['polpo-direction'];
  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Initialize database schema on first call
  await initializeSchema(db);

  // Parse the API path
  const path = pathname.replace('/api/', '').toLowerCase();
  const parts = path.split('/').filter(Boolean);
  const resource = parts[0];
  const id = parts[1];

  try {
    // Health check endpoint
    if (path === 'health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'ok', ts: new Date().toISOString() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Bootstrap endpoint: return all collections needed for app startup
    if (path === 'bootstrap' && request.method === 'GET') {
      const employees = await getAllRecords(db, 'employees');
      const templates = await getAllRecords(db, 'templates');
      const plannings = await getAllRecords(db, 'plannings');
      const roles = await getAllRecords(db, 'roles');
      const longAbsences = await getAllRecords(db, 'longAbsences');
      const settings = await getAllSettings(db);

      return new Response(
        JSON.stringify({
          employees,
          templates,
          plannings,
          roles,
          longAbsences,
          settings,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Employees resource
    if (resource === 'employees') {
      if (request.method === 'GET' && !id) {
        const employees = await getAllRecords(db, 'employees');
        return new Response(JSON.stringify(employees), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'GET' && id) {
        const employee = await getRecordById(db, 'employees', id);
        return new Response(JSON.stringify(employee || {}), {
          status: employee ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const newId = crypto.randomUUID();
        await insertRecord(db, 'employees', {
          id: newId,
          ...body,
        });
        return new Response(JSON.stringify({ ok: true, id: newId }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'PUT' && id) {
        const body = await request.json();
        await updateRecord(db, 'employees', id, body);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'DELETE' && id) {
        await deleteRecord(db, 'employees', id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Templates resource
    if (resource === 'templates') {
      if (request.method === 'GET' && !id) {
        const templates = await getAllRecords(db, 'templates');
        return new Response(JSON.stringify(templates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'GET' && id) {
        const template = await getRecordById(db, 'templates', id);
        return new Response(JSON.stringify(template || {}), {
          status: template ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const newId = body.id || crypto.randomUUID();
        await insertRecord(db, 'templates', {
          id: newId,
          ...body,
        });
        return new Response(JSON.stringify({ ok: true, id: newId }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'PUT' && id) {
        const body = await request.json();
        await updateRecord(db, 'templates', id, body);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'DELETE' && id) {
        await deleteRecord(db, 'templates', id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Plannings resource
    if (resource === 'plannings') {
      if (request.method === 'GET' && !id) {
        const plannings = await getAllRecords(db, 'plannings');
        return new Response(JSON.stringify(plannings), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'GET' && id) {
        const planning = await getRecordById(db, 'plannings', id);
        return new Response(JSON.stringify(planning || {}), {
          status: planning ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const newId = crypto.randomUUID();
        await insertRecord(db, 'plannings', {
          id: newId,
          ...body,
        });
        return new Response(JSON.stringify({ ok: true, id: newId }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'PUT' && id) {
        const body = await request.json();
        await updateRecord(db, 'plannings', id, body);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'DELETE' && id) {
        await deleteRecord(db, 'plannings', id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Roles resource
    if (resource === 'roles') {
      if (request.method === 'GET' && !id) {
        const roles = await getAllRecords(db, 'roles');
        return new Response(JSON.stringify(roles), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'GET' && id) {
        const role = await getRecordById(db, 'roles', id);
        return new Response(JSON.stringify(role || {}), {
          status: role ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const newId = body.id || crypto.randomUUID();
        await insertRecord(db, 'roles', {
          id: newId,
          ...body,
        });
        return new Response(JSON.stringify({ ok: true, id: newId }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'PUT' && id) {
        const body = await request.json();
        await updateRecord(db, 'roles', id, body);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'DELETE' && id) {
        await deleteRecord(db, 'roles', id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // LongAbsences resource
    if (resource === 'longabsences') {
      if (request.method === 'GET' && !id) {
        const absences = await getAllRecords(db, 'longAbsences');
        return new Response(JSON.stringify(absences), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'GET' && id) {
        const absence = await getRecordById(db, 'longAbsences', id);
        return new Response(JSON.stringify(absence || {}), {
          status: absence ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const newId = crypto.randomUUID();
        await insertRecord(db, 'longAbsences', {
          id: newId,
          ...body,
        });
        return new Response(JSON.stringify({ ok: true, id: newId }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'PUT' && id) {
        const body = await request.json();
        await updateRecord(db, 'longAbsences', id, body);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'DELETE' && id) {
        await deleteRecord(db, 'longAbsences', id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Settings resource
    if (resource === 'settings') {
      if (request.method === 'GET' && !id) {
        const settings = await getAllSettings(db);
        return new Response(JSON.stringify(settings), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'GET' && id) {
        const value = await getSetting(db, id);
        return new Response(JSON.stringify({ key: id, value: value ?? null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const value = body.value ?? null;
        await setSetting(db, id, value);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'DELETE' && id) {
        await deleteSetting(db, id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Migration endpoint
    if (path === 'migrate' && request.method === 'POST') {
      const body = await request.json();
      await performMigration(db, body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 404 for unknown endpoints
    return new Response(
      JSON.stringify({ error: 'Not Found', path: pathname }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API Error]', errorMsg, error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// ===================== HELPER FUNCTIONS =====================

async function initializeSchema(db: D1Database) {
  // Create tables if they don't exist
  const tables = [
    'employees',
    'templates',
    'plannings',
    'roles',
    'longAbsences',
    'settings',
  ];

  for (const table of tables) {
    const exists = await tableExists(db, table);
    if (exists) continue;

    if (table === 'employees') {
      await db.exec(`
        CREATE TABLE employees (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          weeklyDefault TEXT,
          isActive INTEGER DEFAULT 1,
          createdAt INTEGER,
          updatedAt INTEGER
        )
      `);
    } else if (table === 'templates') {
      await db.exec(`
        CREATE TABLE templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          serviceType TEXT,
          slots TEXT,
          color TEXT,
          createdAt INTEGER,
          updatedAt INTEGER
        )
      `);
    } else if (table === 'plannings') {
      await db.exec(`
        CREATE TABLE plannings (
          id TEXT PRIMARY KEY,
          weekStart TEXT NOT NULL,
          weekEnd TEXT NOT NULL,
          service TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          rows TEXT,
          extraShifts TEXT,
          createdAt INTEGER,
          updatedAt INTEGER
        )
      `);
    } else if (table === 'roles') {
      await db.exec(`
        CREATE TABLE roles (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          createdAt INTEGER,
          updatedAt INTEGER
        )
      `);
    } else if (table === 'longAbsences') {
      await db.exec(`
        CREATE TABLE longAbsences (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          type TEXT NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          createdAt INTEGER,
          updatedAt INTEGER
        )
      `);
    } else if (table === 'settings') {
      await db.exec(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          createdAt INTEGER,
          updatedAt INTEGER
        )
      `);
    }
  }
}

async function tableExists(db: D1Database, tableName: string): Promise<boolean> {
  try {
    const result = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).bind(tableName).first();
    return !!result;
  } catch {
    return false;
  }
}

async function getAllRecords(db: D1Database, table: string): Promise<any[]> {
  try {
    const result = await db.prepare(`SELECT * FROM ${table}`).all();
    return (result.results || []).map(row => deserializeRecord(row, table));
  } catch (error) {
    console.error(`Error fetching ${table}:`, error);
    return [];
  }
}

async function getRecordById(db: D1Database, table: string, id: string): Promise<any | null> {
  try {
    const result = await db
      .prepare(`SELECT * FROM ${table} WHERE id = ?`)
      .bind(id)
      .first();
    return result ? deserializeRecord(result, table) : null;
  } catch (error) {
    console.error(`Error fetching ${table} by id:`, error);
    return null;
  }
}

async function insertRecord(db: D1Database, table: string, record: any): Promise<void> {
  const now = Date.now();
  const serialized = serializeRecord(record, table);
  const keys = Object.keys(serialized);
  const values = Object.values(serialized);
  const placeholders = keys.map(() => '?').join(',');
  const cols = keys.join(',');

  try {
    await db
      .prepare(`INSERT INTO ${table} (${cols}, createdAt, updatedAt) VALUES (${placeholders}, ?, ?)`)
      .bind(...values, now, now)
      .run();
  } catch (error) {
    console.error(`Error inserting into ${table}:`, error);
    throw error;
  }
}

async function updateRecord(db: D1Database, table: string, id: string, updates: any): Promise<void> {
  const now = Date.now();
  const serialized = serializeRecord(updates, table);
  const keys = Object.keys(serialized);
  const setClauses = keys.map(key => `${key} = ?`).join(', ');
  const values = Object.values(serialized);

  try {
    await db
      .prepare(`UPDATE ${table} SET ${setClauses}, updatedAt = ? WHERE id = ?`)
      .bind(...values, now, id)
      .run();
  } catch (error) {
    console.error(`Error updating ${table}:`, error);
    throw error;
  }
}

async function deleteRecord(db: D1Database, table: string, id: string): Promise<void> {
  try {
    await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  } catch (error) {
    console.error(`Error deleting from ${table}:`, error);
    throw error;
  }
}

async function getAllSettings(db: D1Database): Promise<Record<string, any>> {
  try {
    const result = await db.prepare(`SELECT key, value FROM settings`).all();
    const record: Record<string, any> = {};
    for (const row of result.results || []) {
      record[row.key] = tryParseJSON(row.value);
    }
    return record;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return {};
  }
}

async function getSetting(db: D1Database, key: string): Promise<any | null> {
  try {
    const result = await db
      .prepare(`SELECT value FROM settings WHERE key = ?`)
      .bind(key)
      .first();
    return result ? tryParseJSON(result.value) : null;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return null;
  }
}

async function setSetting(db: D1Database, key: string, value: any): Promise<void> {
  const now = Date.now();
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    // Upsert logic
    await db.exec(`
      INSERT INTO settings (key, value, createdAt, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?
    `);
    
    // Alternative simpler approach using prepare
    const existing = await getSetting(db, key);
    if (existing !== null) {
      await db
        .prepare(`UPDATE settings SET value = ?, updatedAt = ? WHERE key = ?`)
        .bind(serialized, now, key)
        .run();
    } else {
      await db
        .prepare(`INSERT INTO settings (key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?)`)
        .bind(key, serialized, now, now)
        .run();
    }
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    throw error;
  }
}

async function deleteSetting(db: D1Database, key: string): Promise<void> {
  try {
    await db.prepare(`DELETE FROM settings WHERE key = ?`).bind(key).run();
  } catch (error) {
    console.error(`Error deleting setting ${key}:`, error);
    throw error;
  }
}

async function performMigration(db: D1Database, payload: any): Promise<void> {
  const now = Date.now();

  // Migrate employees
  if (Array.isArray(payload.employees)) {
    for (const emp of payload.employees) {
      await insertRecord(db, 'employees', {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        weeklyDefault: emp.weeklyDefault ? JSON.stringify(emp.weeklyDefault) : null,
        isActive: emp.isActive ?? 1,
      });
    }
  }

  // Migrate templates
  if (Array.isArray(payload.templates)) {
    for (const tpl of payload.templates) {
      await insertRecord(db, 'templates', {
        id: tpl.id,
        name: tpl.name,
        role: tpl.role,
        serviceType: tpl.serviceType,
        slots: JSON.stringify(tpl.slots || []),
        color: tpl.color,
      });
    }
  }

  // Migrate plannings
  if (Array.isArray(payload.plannings)) {
    for (const planning of payload.plannings) {
      await insertRecord(db, 'plannings', {
        id: planning.id,
        weekStart: planning.weekStart,
        weekEnd: planning.weekEnd,
        service: planning.service,
        status: planning.status || 'active',
        rows: JSON.stringify(planning.rows || []),
        extraShifts: JSON.stringify(planning.extraShifts || []),
      });
    }
  }

  // Migrate roles
  if (Array.isArray(payload.roles)) {
    for (const role of payload.roles) {
      await insertRecord(db, 'roles', {
        id: role.id,
        label: role.label,
      });
    }
  }

  // Migrate longAbsences
  if (Array.isArray(payload.longAbsences)) {
    for (const absence of payload.longAbsences) {
      await insertRecord(db, 'longAbsences', {
        id: absence.id,
        employeeId: absence.employeeId,
        type: absence.type,
        startDate: absence.startDate,
        endDate: absence.endDate,
      });
    }
  }

  // Mark migration as done
  await setSetting(db, 'import_done', true);
}

function serializeRecord(record: any, table: string): any {
  const copy = { ...record };
  
  // Remove system fields
  delete copy.createdAt;
  delete copy.updatedAt;
  
  // Serialize complex fields as JSON strings
  if (table === 'employees' && copy.weeklyDefault) {
    copy.weeklyDefault = typeof copy.weeklyDefault === 'string' 
      ? copy.weeklyDefault 
      : JSON.stringify(copy.weeklyDefault);
  }
  
  if (table === 'templates' && copy.slots) {
    copy.slots = typeof copy.slots === 'string' 
      ? copy.slots 
      : JSON.stringify(copy.slots);
  }
  
  if (table === 'plannings') {
    if (copy.rows) {
      copy.rows = typeof copy.rows === 'string' 
        ? copy.rows 
        : JSON.stringify(copy.rows);
    }
    if (copy.extraShifts) {
      copy.extraShifts = typeof copy.extraShifts === 'string' 
        ? copy.extraShifts 
        : JSON.stringify(copy.extraShifts);
    }
  }
  
  return copy;
}

function deserializeRecord(row: any, table: string): any {
  const record = { ...row };
  
  // Deserialize JSON fields
  if (table === 'employees' && typeof record.weeklyDefault === 'string') {
    try {
      record.weeklyDefault = JSON.parse(record.weeklyDefault);
    } catch {
      record.weeklyDefault = {};
    }
  }
  
  if (table === 'templates' && typeof record.slots === 'string') {
    try {
      record.slots = JSON.parse(record.slots);
    } catch {
      record.slots = [];
    }
  }
  
  if (table === 'plannings') {
    if (typeof record.rows === 'string') {
      try {
        record.rows = JSON.parse(record.rows);
      } catch {
        record.rows = [];
      }
    }
    if (typeof record.extraShifts === 'string') {
      try {
        record.extraShifts = JSON.parse(record.extraShifts);
      } catch {
        record.extraShifts = [];
      }
    }
  }
  
  return record;
}

function tryParseJSON(str: any): any {
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// Type definitions for Cloudflare Workers
interface D1Database {
  prepare(query: string): any;
  exec(query: string): Promise<any>;
}

interface PagesFunction {
  (context: any): Response | Promise<Response>;
}
