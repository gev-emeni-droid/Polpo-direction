import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';

const app = new Hono();

// CORS configuration
app.use('/*', cors({
  origin: ['http://localhost:5173', 'https://polpo-direction.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Helper function to generate UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Helper function to format response
function success(data, message = 'Success') {
  return { success: true, message, data };
}

function error(message, status = 400) {
  return { success: false, message, status };
}

// ===== ROLES =====
app.get('/api/roles', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM roles ORDER BY sort_order, name').all();
    return c.json(success(result.results));
  } catch (e) {
    return c.json(error('Failed to fetch roles'), 500);
  }
});

app.post('/api/roles', validator('json'), async (c) => {
  try {
    const { name, slug, sort_order = 0, header_bg_color, is_active = 1 } = await c.req.json();
    const id = generateUUID();
    
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
    return c.json(error('Failed to create role'), 500);
  }
});

app.put('/api/roles/:id', validator('json'), async (c) => {
  try {
    const id = c.req.param('id');
    const { name, slug, sort_order, header_bg_color, is_active } = await c.req.json();
    
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
    return c.json(error('Failed to update role'), 500);
  }
});

app.delete('/api/roles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Check if role is used by employees
    const employees = await c.env.DB.prepare('SELECT COUNT(*) as count FROM employees WHERE role_id = ?').bind(id).first();
    if (employees.count > 0) {
      return c.json(error('Cannot delete role: it is assigned to employees'), 400);
    }
    
    const result = await c.env.DB.prepare('DELETE FROM roles WHERE id = ?').bind(id).run();
    if (result.success) {
      return c.json(success(null, 'Role deleted successfully'));
    }
    return c.json(error('Failed to delete role'), 500);
  } catch (e) {
    return c.json(error('Failed to delete role'), 500);
  }
});

// ===== EMPLOYEES =====
app.get('/api/employees', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT e.*, r.name as role_name 
      FROM employees e 
      LEFT JOIN roles r ON e.role_id = r.id 
      ORDER BY r.sort_order, e.last_name, e.first_name
    `).all();
    return c.json(success(result.results));
  } catch (e) {
    return c.json(error('Failed to fetch employees'), 500);
  }
});

app.post('/api/employees', validator('json'), async (c) => {
  try {
    const { first_name, last_name, display_name, role_id, status = 'active', contract_hours_week, contract_type, is_external = 0, external_category, email, phone } = await c.req.json();
    const id = generateUUID();
    
    const result = await c.env.DB.prepare(`
      INSERT INTO employees (id, first_name, last_name, display_name, role_id, status, contract_hours_week, contract_type, is_external, external_category, email, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, first_name, last_name, display_name, role_id, status, contract_hours_week, contract_type, is_external, external_category, email, phone).run();
    
    if (result.success) {
      const newEmployee = await c.env.DB.prepare('SELECT e.*, r.name as role_name FROM employees e LEFT JOIN roles r ON e.role_id = r.id WHERE e.id = ?').bind(id).first();
      return c.json(success(newEmployee, 'Employee created successfully'));
    }
    return c.json(error('Failed to create employee'), 500);
  } catch (e) {
    return c.json(error('Failed to create employee'), 500);
  }
});

app.put('/api/employees/:id', validator('json'), async (c) => {
  try {
    const id = c.req.param('id');
    const { first_name, last_name, display_name, role_id, status, contract_hours_week, contract_type, is_external, external_category, email, phone } = await c.req.json();
    
    const result = await c.env.DB.prepare(`
      UPDATE employees SET first_name = ?, last_name = ?, display_name = ?, role_id = ?, status = ?, contract_hours_week = ?, contract_type = ?, is_external = ?, external_category = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(first_name, last_name, display_name, role_id, status, contract_hours_week, contract_type, is_external, external_category, email, phone, id).run();
    
    if (result.success) {
      const updatedEmployee = await c.env.DB.prepare('SELECT e.*, r.name as role_name FROM employees e LEFT JOIN roles r ON e.role_id = r.id WHERE e.id = ?').bind(id).first();
      return c.json(success(updatedEmployee, 'Employee updated successfully'));
    }
    return c.json(error('Failed to update employee'), 500);
  } catch (e) {
    return c.json(error('Failed to update employee'), 500);
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
    return c.json(error('Failed to delete employee'), 500);
  }
});

// ===== SHIFT CODES =====
app.get('/api/shift-codes', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM shift_codes ORDER BY is_rest DESC, is_absence ASC, label').all();
    return c.json(success(result.results));
  } catch (e) {
    return c.json(error('Failed to fetch shift codes'), 500);
  }
});

app.post('/api/shift-codes', validator('json'), async (c) => {
  try {
    const { code, label, default_color, default_start_midi, default_end_midi, default_start_soir, default_end_soir, is_absence = 0, is_rest = 0 } = await c.req.json();
    
    const result = await c.env.DB.prepare(`
      INSERT INTO shift_codes (code, label, default_color, default_start_midi, default_end_midi, default_start_soir, default_end_soir, is_absence, is_rest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(code, label, default_color, default_start_midi, default_end_midi, default_start_soir, default_end_soir, is_absence, is_rest).run();
    
    if (result.success) {
      const newCode = await c.env.DB.prepare('SELECT * FROM shift_codes WHERE code = ?').bind(code).first();
      return c.json(success(newCode, 'Shift code created successfully'));
    }
    return c.json(error('Failed to create shift code'), 500);
  } catch (e) {
    return c.json(error('Failed to create shift code'), 500);
  }
});

// ===== SHIFTS =====
app.get('/api/shifts', async (c) => {
  try {
    const { from, to, employee_id } = c.req.query();
    
    let query = `
      SELECT s.*, e.first_name, e.last_name, e.display_name, r.name as role_name
      FROM shifts s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN roles r ON s.role_id = r.id
    `;
    let params = [];
    
    if (from && to) {
      query += ' WHERE s.date BETWEEN ? AND ?';
      params.push(from, to);
    }
    
    if (employee_id) {
      query += params.length > 0 ? ' AND s.employee_id = ?' : ' WHERE s.employee_id = ?';
      params.push(employee_id);
    }
    
    query += ' ORDER BY s.date, e.last_name, e.first_name';
    
    const result = await c.env.DB.prepare(query).bind(...params).all();
    return c.json(success(result.results));
  } catch (e) {
    return c.json(error('Failed to fetch shifts'), 500);
  }
});

app.post('/api/shifts', validator('json'), async (c) => {
  try {
    const { employee_id, date, role_id, notes, segments } = await c.req.json();
    const id = generateUUID();
    
    // Create shift
    const shiftResult = await c.env.DB.prepare(`
      INSERT INTO shifts (id, employee_id, date, role_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, employee_id, date, role_id, notes).run();
    
    if (!shiftResult.success) {
      return c.json(error('Failed to create shift'), 500);
    }
    
    // Create segments if provided
    if (segments && segments.length > 0) {
      for (const segment of segments) {
        const segmentId = generateUUID();
        await c.env.DB.prepare(`
          INSERT INTO shift_segments (id, shift_id, segment, code, label_override, start_time, end_time, color_override)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(segmentId, id, segment.segment, segment.code, segment.label_override, segment.start_time, segment.end_time, segment.color_override).run();
      }
    }
    
    const newShift = await c.env.DB.prepare(`
      SELECT s.*, e.first_name, e.last_name, e.display_name, r.name as role_name
      FROM shifts s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN roles r ON s.role_id = r.id
      WHERE s.id = ?
    `).bind(id).first();
    
    return c.json(success(newShift, 'Shift created successfully'));
  } catch (e) {
    return c.json(error('Failed to create shift'), 500);
  }
});

// ===== SETTINGS =====
app.get('/api/settings', async (c) => {
  try {
    const { scope = 'global' } = c.req.query();
    const result = await c.env.DB.prepare('SELECT * FROM settings WHERE scope = ?').bind(scope).all();
    return c.json(success(result.results));
  } catch (e) {
    return c.json(error('Failed to fetch settings'), 500);
  }
});

app.put('/api/settings/:scope/:key', validator('json'), async (c) => {
  try {
    const { scope, key } = c.req.param();
    const { value_json } = await c.req.json();
    
    const result = await c.env.DB.prepare(`
      INSERT OR REPLACE INTO settings (scope, key, value_json, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(scope, key, value_json).run();
    
    if (result.success) {
      const updatedSetting = await c.env.DB.prepare('SELECT * FROM settings WHERE scope = ? AND key = ?').bind(scope, key).first();
      return c.json(success(updatedSetting, 'Setting updated successfully'));
    }
    return c.json(error('Failed to update setting'), 500);
  } catch (e) {
    return c.json(error('Failed to update setting'), 500);
  }
});

// Health check
app.get('/api/health', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM roles').first();
    return c.json(success({ database: 'connected', roles_count: result.count }, 'API is healthy'));
  } catch (e) {
    return c.json(error('Database connection failed'), 500);
  }
});

export default {
  fetch: app.fetch,
};
