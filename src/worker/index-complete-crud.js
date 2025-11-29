import { Hono } from 'hono';

const app = new Hono();

// Origins autorisées
const allowedOrigins = new Set([
  "https://05d5d318.polpo-direction.pages.dev",
  "https://polpo.direction.l-iamani.com",
  "https://polpo-direction.pages.dev",
  "http://localhost:5173",
  "http://localhost:8787",
]);

// Middleware CORS personnalisé
app.use('/api/*', async (c, next) => {
  const origin = c.req.header('Origin');
  
  const corsHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-IMPORT-SECRET',
    'Access-Control-Max-Age': '86400',
  };

  if (origin && allowedOrigins.has(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  }

  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  await next();
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

// Helper functions
function generateUUID() {
  return crypto.randomUUID();
}

function success(data, message = 'Success') {
  return { success: true, message, data };
}

function error(message, status = 400) {
  return { success: false, message, status };
}

// ===== HEALTH CHECK =====
app.get('/api/health', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json(error('Database binding not available'), 500);
    }
    
    const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM roles').first();
    return c.json(success({
      database: 'connected',
      roles_count: result.count
    }, 'API is healthy'));
  } catch (e) {
    console.error('Health check error:', e);
    return c.json(error('API health check failed: ' + e.message), 500);
  }
});

// ===== ROLES =====
app.get('/api/roles', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM roles ORDER BY sort_order, name').all();
    return c.json(success(result.results));
  } catch (e) {
    console.error('Roles fetch error:', e);
    return c.json(error('Failed to fetch roles: ' + e.message), 500);
  }
});

app.post('/api/roles', async (c) => {
  try {
    const body = await c.req.json();
    const { name, slug, sort_order = 0, header_bg_color, is_active = 1 } = body;
    const id = generateUUID();
    
    // Validation
    if (!name || !slug) {
      return c.json(error('Name and slug are required'), 400);
    }
    
    const result = await c.env.DB.prepare(`
      INSERT INTO roles (id, name, slug, sort_order, header_bg_color, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, name, slug, sort_order, header_bg_color, is_active).run();
    
    if (result.success) {
      const newRole = await c.env.DB.prepare('SELECT * FROM roles WHERE id = ?').bind(id).first();
      return c.json(success(newRole, 'Role created successfully'));
    }
    return c.json(error('Failed to create role'), 500);
  } catch (e) {
    console.error('Role creation error:', e);
    return c.json(error('Role creation failed: ' + e.message), 500);
  }
});

app.put('/api/roles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, slug, sort_order, header_bg_color, is_active } = body;
    
    // Validation
    if (!name || !slug) {
      return c.json(error('Name and slug are required'), 400);
    }
    
    const result = await c.env.DB.prepare(`
      UPDATE roles SET name = ?, slug = ?, sort_order = ?, header_bg_color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name, slug, sort_order, header_bg_color, is_active, id).run();
    
    if (result.success) {
      const updatedRole = await c.env.DB.prepare('SELECT * FROM roles WHERE id = ?').bind(id).first();
      return c.json(success(updatedRole, 'Role updated successfully'));
    }
    return c.json(error('Failed to update role'), 500);
  } catch (e) {
    console.error('Role update error:', e);
    return c.json(error('Role update failed: ' + e.message), 500);
  }
});

app.delete('/api/roles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const result = await c.env.DB.prepare('DELETE FROM roles WHERE id = ?').bind(id).run();
    
    if (result.success) {
      return c.json(success(null, 'Role deleted successfully'));
    }
    return c.json(error('Failed to delete role'), 500);
  } catch (e) {
    console.error('Role deletion error:', e);
    return c.json(error('Role deletion failed: ' + e.message), 500);
  }
});

// ===== EMPLOYEES =====
app.get('/api/employees', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT e.*, r.name as role_name 
      FROM employees e 
      LEFT JOIN roles r ON e.role_id = r.id 
      ORDER BY e.is_external, e.display_name, e.first_name, e.last_name
    `).all();
    return c.json(success(result.results));
  } catch (e) {
    console.error('Employees fetch error:', e);
    return c.json(error('Failed to fetch employees: ' + e.message), 500);
  }
});

app.post('/api/employees', async (c) => {
  try {
    const body = await c.req.json();
    const { 
      first_name, last_name, display_name, role_id, status = 'active', 
      contract_hours_week, contract_type, is_external = 0, external_category,
      email, phone 
    } = body;
    const id = generateUUID();
    
    // Validation
    if (!first_name || !last_name) {
      return c.json(error('First name and last name are required'), 400);
    }
    
    const result = await c.env.DB.prepare(`
      INSERT INTO employees (id, first_name, last_name, display_name, role_id, status, 
                              contract_hours_week, contract_type, is_external, external_category,
                              email, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, first_name, last_name, display_name, role_id, status, 
            contract_hours_week, contract_type, is_external, external_category,
            email, phone).run();
    
    if (result.success) {
      const newEmployee = await c.env.DB.prepare(`
        SELECT e.*, r.name as role_name 
        FROM employees e 
        LEFT JOIN roles r ON e.role_id = r.id 
        WHERE e.id = ?
      `).bind(id).first();
      return c.json(success(newEmployee, 'Employee created successfully'));
    }
    return c.json(error('Failed to create employee'), 500);
  } catch (e) {
    console.error('Employee creation error:', e);
    return c.json(error('Employee creation failed: ' + e.message), 500);
  }
});

app.put('/api/employees/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { 
      first_name, last_name, display_name, role_id, status, 
      contract_hours_week, contract_type, is_external, external_category,
      email, phone 
    } = body;
    
    // Validation
    if (!first_name || !last_name) {
      return c.json(error('First name and last name are required'), 400);
    }
    
    const result = await c.env.DB.prepare(`
      UPDATE employees SET first_name = ?, last_name = ?, display_name = ?, role_id = ?, status = ?,
                          contract_hours_week = ?, contract_type = ?, is_external = ?, external_category = ?,
                          email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(first_name, last_name, display_name, role_id, status,
            contract_hours_week, contract_type, is_external, external_category,
            email, phone, id).run();
    
    if (result.success) {
      const updatedEmployee = await c.env.DB.prepare(`
        SELECT e.*, r.name as role_name 
        FROM employees e 
        LEFT JOIN roles r ON e.role_id = r.id 
        WHERE e.id = ?
      `).bind(id).first();
      return c.json(success(updatedEmployee, 'Employee updated successfully'));
    }
    return c.json(error('Failed to update employee'), 500);
  } catch (e) {
    console.error('Employee update error:', e);
    return c.json(error('Employee update failed: ' + e.message), 500);
  }
});

app.delete('/api/employees/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const result = await c.env.DB.prepare('DELETE FROM employees WHERE id = ?').bind(id).run();
    
    if (result.success) {
      return c.json(success(null, 'Employee deleted successfully'));
    }
    return c.json(error('Failed to delete employee'), 500);
  } catch (e) {
    console.error('Employee deletion error:', e);
    return c.json(error('Employee deletion failed: ' + e.message), 500);
  }
});

// ===== SHIFT CODES =====
app.get('/api/shift-codes', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM shift_codes ORDER BY code').all();
    return c.json(success(result.results));
  } catch (e) {
    console.error('Shift codes fetch error:', e);
    return c.json(error('Failed to fetch shift codes: ' + e.message), 500);
  }
});

app.post('/api/shift-codes', async (c) => {
  try {
    const body = await c.req.json();
    const { 
      code, label, default_color, default_start_midi, default_end_midi,
      default_start_soir, default_end_soir, is_absence = 0, is_rest = 0 
    } = body;
    
    // Validation
    if (!code || !label) {
      return c.json(error('Code and label are required'), 400);
    }
    
    const result = await c.env.DB.prepare(`
      INSERT INTO shift_codes (code, label, default_color, default_start_midi, default_end_midi,
                               default_start_soir, default_end_soir, is_absence, is_rest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(code, label, default_color, default_start_midi, default_end_midi,
            default_start_soir, default_end_soir, is_absence, is_rest).run();
    
    if (result.success) {
      const newCode = await c.env.DB.prepare('SELECT * FROM shift_codes WHERE code = ?').bind(code).first();
      return c.json(success(newCode, 'Shift code created successfully'));
    }
    return c.json(error('Failed to create shift code'), 500);
  } catch (e) {
    console.error('Shift code creation error:', e);
    return c.json(error('Shift code creation failed: ' + e.message), 500);
  }
});

app.put('/api/shift-codes/:code', async (c) => {
  try {
    const code = c.req.param('code');
    const body = await c.req.json();
    const { 
      label, default_color, default_start_midi, default_end_midi,
      default_start_soir, default_end_soir, is_absence, is_rest 
    } = body;
    
    // Validation
    if (!label) {
      return c.json(error('Label is required'), 400);
    }
    
    const result = await c.env.DB.prepare(`
      UPDATE shift_codes SET label = ?, default_color = ?, default_start_midi = ?, default_end_midi = ?,
                              default_start_soir = ?, default_end_soir = ?, is_absence = ?, is_rest = ?,
                              updated_at = CURRENT_TIMESTAMP
      WHERE code = ?
    `).bind(label, default_color, default_start_midi, default_end_midi,
            default_start_soir, default_end_soir, is_absence, is_rest, code).run();
    
    if (result.success) {
      const updatedCode = await c.env.DB.prepare('SELECT * FROM shift_codes WHERE code = ?').bind(code).first();
      return c.json(success(updatedCode, 'Shift code updated successfully'));
    }
    return c.json(error('Failed to update shift code'), 500);
  } catch (e) {
    console.error('Shift code update error:', e);
    return c.json(error('Shift code update failed: ' + e.message), 500);
  }
});

app.delete('/api/shift-codes/:code', async (c) => {
  try {
    const code = c.req.param('code');
    
    const result = await c.env.DB.prepare('DELETE FROM shift_codes WHERE code = ?').bind(code).run();
    
    if (result.success) {
      return c.json(success(null, 'Shift code deleted successfully'));
    }
    return c.json(error('Failed to delete shift code'), 500);
  } catch (e) {
    console.error('Shift code deletion error:', e);
    return c.json(error('Shift code deletion failed: ' + e.message), 500);
  }
});

// ===== SHIFTS =====
app.get('/api/shifts', async (c) => {
  try {
    const { employee_id, date_start, date_end } = c.req.query();
    
    let query = `
      SELECT s.*, e.first_name, e.last_name, e.display_name,
             r.name as role_name,
             (SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT('id', seg.id, 'segment', seg.segment, 'code', seg.code, 
                           'label_override', seg.label_override, 'start_time', seg.start_time,
                           'end_time', seg.end_time, 'color_override', seg.color_override)
              ) FROM shift_segments seg WHERE seg.shift_id = s.id ORDER BY seg.segment) as segments
      FROM shifts s
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN roles r ON s.role_id = r.id
    `;
    
    const bindings = [];
    const conditions = [];
    
    if (employee_id) {
      conditions.push('s.employee_id = ?');
      bindings.push(employee_id);
    }
    
    if (date_start) {
      conditions.push('s.date >= ?');
      bindings.push(date_start);
    }
    
    if (date_end) {
      conditions.push('s.date <= ?');
      bindings.push(date_end);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY s.date, e.display_name';
    
    const result = await c.env.DB.prepare(query).bind(...bindings).all();
    
    // Parse JSON segments
    const shifts = result.results.map(s => ({
      ...s,
      segments: s.segments ? JSON.parse(s.segments) : []
    }));
    
    return c.json(success(shifts));
  } catch (e) {
    console.error('Shifts fetch error:', e);
    return c.json(error('Failed to fetch shifts: ' + e.message), 500);
  }
});

app.post('/api/shifts', async (c) => {
  try {
    const body = await c.req.json();
    const { employee_id, date, role_id, notes, segments = [] } = body;
    const id = generateUUID();
    
    // Validation
    if (!employee_id || !date) {
      return c.json(error('Employee ID and date are required'), 400);
    }
    
    // Transaction: Insert shift and segments
    const shiftResult = await c.env.DB.prepare(`
      INSERT INTO shifts (id, employee_id, date, role_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, employee_id, date, role_id, notes).run();
    
    if (!shiftResult.success) {
      return c.json(error('Failed to create shift'), 500);
    }
    
    // Insert segments
    for (const segment of segments) {
      // Validation
      if (!['midi', 'soir'].includes(segment.segment)) {
        return c.json(error('Segment must be "midi" or "soir"'), 400);
      }
      
      const segmentId = generateUUID();
      await c.env.DB.prepare(`
        INSERT INTO shift_segments (id, shift_id, segment, code, label_override, start_time, end_time, color_override)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(segmentId, id, segment.segment, segment.code, segment.label_override, 
              segment.start_time, segment.end_time, segment.color_override).run();
    }
    
    const newShift = await c.env.DB.prepare(`
      SELECT s.*, e.first_name, e.last_name, e.display_name,
             r.name as role_name,
             (SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT('id', seg.id, 'segment', seg.segment, 'code', seg.code, 
                           'label_override', seg.label_override, 'start_time', seg.start_time,
                           'end_time', seg.end_time, 'color_override', seg.color_override)
              ) FROM shift_segments seg WHERE seg.shift_id = s.id ORDER BY seg.segment) as segments
      FROM shifts s
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN roles r ON s.role_id = r.id
      WHERE s.id = ?
    `).bind(id).first();
    
    const parsedShift = {
      ...newShift,
      segments: newShift.segments ? JSON.parse(newShift.segments) : []
    };
    
    return c.json(success(parsedShift, 'Shift created successfully'));
  } catch (e) {
    console.error('Shift creation error:', e);
    return c.json(error('Shift creation failed: ' + e.message), 500);
  }
});

app.put('/api/shifts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { role_id, notes, segments = [] } = body;
    
    // Update shift
    const shiftResult = await c.env.DB.prepare(`
      UPDATE shifts SET role_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(role_id, notes, id).run();
    
    if (!shiftResult.success) {
      return c.json(error('Failed to update shift'), 500);
    }
    
    // Delete existing segments and recreate
    await c.env.DB.prepare('DELETE FROM shift_segments WHERE shift_id = ?').bind(id).run();
    
    // Insert new segments
    for (const segment of segments) {
      // Validation
      if (!['midi', 'soir'].includes(segment.segment)) {
        return c.json(error('Segment must be "midi" or "soir"'), 400);
      }
      
      const segmentId = generateUUID();
      await c.env.DB.prepare(`
        INSERT INTO shift_segments (id, shift_id, segment, code, label_override, start_time, end_time, color_override)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(segmentId, id, segment.segment, segment.code, segment.label_override, 
              segment.start_time, segment.end_time, segment.color_override).run();
    }
    
    const updatedShift = await c.env.DB.prepare(`
      SELECT s.*, e.first_name, e.last_name, e.display_name,
             r.name as role_name,
             (SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT('id', seg.id, 'segment', seg.segment, 'code', seg.code, 
                           'label_override', seg.label_override, 'start_time', seg.start_time,
                           'end_time', seg.end_time, 'color_override', seg.color_override)
              ) FROM shift_segments seg WHERE seg.shift_id = s.id ORDER BY seg.segment) as segments
      FROM shifts s
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN roles r ON s.role_id = r.id
      WHERE s.id = ?
    `).bind(id).first();
    
    const parsedShift = {
      ...updatedShift,
      segments: updatedShift.segments ? JSON.parse(updatedShift.segments) : []
    };
    
    return c.json(success(parsedShift, 'Shift updated successfully'));
  } catch (e) {
    console.error('Shift update error:', e);
    return c.json(error('Shift update failed: ' + e.message), 500);
  }
});

app.delete('/api/shifts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const result = await c.env.DB.prepare('DELETE FROM shifts WHERE id = ?').bind(id).run();
    
    if (result.success) {
      return c.json(success(null, 'Shift deleted successfully'));
    }
    return c.json(error('Failed to delete shift'), 500);
  } catch (e) {
    console.error('Shift deletion error:', e);
    return c.json(error('Shift deletion failed: ' + e.message), 500);
  }
});

// ===== ABSENCES =====
app.get('/api/absences', async (c) => {
  try {
    const { employee_id, start_date, end_date } = c.req.query();
    
    let query = `
      SELECT a.*, e.first_name, e.last_name, e.display_name,
             sc.label as code_label, sc.default_color as code_color
      FROM absences a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN shift_codes sc ON a.code = sc.code
    `;
    
    const bindings = [];
    const conditions = [];
    
    if (employee_id) {
      conditions.push('a.employee_id = ?');
      bindings.push(employee_id);
    }
    
    if (start_date) {
      conditions.push('a.end_date >= ?');
      bindings.push(start_date);
    }
    
    if (end_date) {
      conditions.push('a.start_date <= ?');
      bindings.push(end_date);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY a.start_date, e.display_name';
    
    const result = await c.env.DB.prepare(query).bind(...bindings).all();
    return c.json(success(result.results));
  } catch (e) {
    console.error('Absences fetch error:', e);
    return c.json(error('Failed to fetch absences: ' + e.message), 500);
  }
});

app.post('/api/absences', async (c) => {
  try {
    const body = await c.req.json();
    const { employee_id, start_date, end_date, code, notes } = body;
    const id = generateUUID();
    
    // Validation
    if (!employee_id || !start_date || !end_date || !code) {
      return c.json(error('Employee ID, start date, end date, and code are required'), 400);
    }
    
    if (start_date > end_date) {
      return c.json(error('Start date must be before or equal to end date'), 400);
    }
    
    const result = await c.env.DB.prepare(`
      INSERT INTO absences (id, employee_id, start_date, end_date, code, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, employee_id, start_date, end_date, code, notes).run();
    
    if (result.success) {
      const newAbsence = await c.env.DB.prepare(`
        SELECT a.*, e.first_name, e.last_name, e.display_name,
               sc.label as code_label, sc.default_color as code_color
        FROM absences a
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN shift_codes sc ON a.code = sc.code
        WHERE a.id = ?
      `).bind(id).first();
      return c.json(success(newAbsence, 'Absence created successfully'));
    }
    return c.json(error('Failed to create absence'), 500);
  } catch (e) {
    console.error('Absence creation error:', e);
    return c.json(error('Absence creation failed: ' + e.message), 500);
  }
});

app.put('/api/absences/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { start_date, end_date, code, notes } = body;
    
    // Validation
    if (!start_date || !end_date || !code) {
      return c.json(error('Start date, end date, and code are required'), 400);
    }
    
    if (start_date > end_date) {
      return c.json(error('Start date must be before or equal to end date'), 400);
    }
    
    const result = await c.env.DB.prepare(`
      UPDATE absences SET start_date = ?, end_date = ?, code = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(start_date, end_date, code, notes, id).run();
    
    if (result.success) {
      const updatedAbsence = await c.env.DB.prepare(`
        SELECT a.*, e.first_name, e.last_name, e.display_name,
               sc.label as code_label, sc.default_color as code_color
        FROM absences a
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN shift_codes sc ON a.code = sc.code
        WHERE a.id = ?
      `).bind(id).first();
      return c.json(success(updatedAbsence, 'Absence updated successfully'));
    }
    return c.json(error('Failed to update absence'), 500);
  } catch (e) {
    console.error('Absence update error:', e);
    return c.json(error('Absence update failed: ' + e.message), 500);
  }
});

app.delete('/api/absences/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const result = await c.env.DB.prepare('DELETE FROM absences WHERE id = ?').bind(id).run();
    
    if (result.success) {
      return c.json(success(null, 'Absence deleted successfully'));
    }
    return c.json(error('Failed to delete absence'), 500);
  } catch (e) {
    console.error('Absence deletion error:', e);
    return c.json(error('Absence deletion failed: ' + e.message), 500);
  }
});

// ===== SETTINGS =====
app.get('/api/settings', async (c) => {
  try {
    const { scope = 'global' } = c.req.query();
    
    const result = await c.env.DB.prepare('SELECT * FROM settings WHERE scope = ? ORDER BY key').bind(scope).all();
    
    // Parse JSON values
    const settings = result.results.map(s => ({
      ...s,
      value_json: JSON.parse(s.value_json)
    }));
    
    return c.json(success(settings));
  } catch (e) {
    console.error('Settings fetch error:', e);
    return c.json(error('Failed to fetch settings: ' + e.message), 500);
  }
});

app.put('/api/settings/:scope/:key', async (c) => {
  try {
    const scope = c.req.param('scope');
    const key = c.req.param('key');
    const body = await c.req.json();
    const { value_json } = body;
    
    const result = await c.env.DB.prepare(`
      INSERT OR REPLACE INTO settings (scope, key, value_json, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(scope, key, JSON.stringify(value_json)).run();
    
    if (result.success) {
      const updatedSetting = await c.env.DB.prepare('SELECT * FROM settings WHERE scope = ? AND key = ?').bind(scope, key).first();
      const parsedSetting = {
        ...updatedSetting,
        value_json: JSON.parse(updatedSetting.value_json)
      };
      return c.json(success(parsedSetting, 'Setting updated successfully'));
    }
    return c.json(error('Failed to update setting'), 500);
  } catch (e) {
    console.error('Setting update error:', e);
    return c.json(error('Setting update failed: ' + e.message), 500);
  }
});

// ===== AUDIT LOG (OPTIONNEL) =====
app.get('/api/audit', async (c) => {
  try {
    const { entity, entity_id, limit = 100 } = c.req.query();
    
    let query = 'SELECT * FROM audit_log';
    const bindings = [];
    const conditions = [];
    
    if (entity) {
      conditions.push('entity = ?');
      bindings.push(entity);
    }
    
    if (entity_id) {
      conditions.push('entity_id = ?');
      bindings.push(entity_id);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    bindings.push(limit);
    
    const result = await c.env.DB.prepare(query).bind(...bindings).all();
    
    // Parse JSON payload
    const auditLogs = result.results.map(log => ({
      ...log,
      payload_json: log.payload_json ? JSON.parse(log.payload_json) : null
    }));
    
    return c.json(success(auditLogs));
  } catch (e) {
    console.error('Audit log fetch error:', e);
    return c.json(error('Failed to fetch audit log: ' + e.message), 500);
  }
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
