import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Origins autorisées
const allowedOrigins = new Set([
  "https://05d5d318.polpo-direction.pages.dev",
  "https://polpo.direction.l-iamani.com",
  "https://polpo-direction.pages.dev",
  "http://localhost:5173",
  "http://localhost:8787",
]);

// Middleware CORS personnalisé pour toutes les routes /api/*
app.use('/api/*', async (c, next) => {
  const origin = c.req.header('Origin');
  
  // Headers CORS de base
  const corsHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-IMPORT-SECRET',
    'Access-Control-Max-Age': '86400',
  };

  // Vérifier si l'origin est autorisée
  if (origin && allowedOrigins.has(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  }

  // Gérer les preflight OPTIONS
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Ajouter les headers CORS à toutes les réponses
  await next();
  
  // S'assurer que les headers CORS sont présents même en cas d'erreur
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

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

// ===== HEALTH CHECK =====
app.get('/api/health', async (c) => {
  try {
    // Test basic DB connection
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

// ===== SHIFTS (BASIC) =====
app.get('/api/shifts', async (c) => {
  try {
    const { employee_id, date_start, date_end } = c.req.query();
    
    let query = `
      SELECT s.*, e.first_name, e.last_name, e.display_name,
             r.name as role_name
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
    return c.json(success(result.results));
  } catch (e) {
    console.error('Shifts fetch error:', e);
    return c.json(error('Failed to fetch shifts: ' + e.message), 500);
  }
});

app.post('/api/shifts', async (c) => {
  try {
    const body = await c.req.json();
    const { employee_id, date, role_id, notes } = body;
    const id = generateUUID();
    
    const result = await c.env.DB.prepare(`
      INSERT INTO shifts (id, employee_id, date, role_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, employee_id, date, role_id, notes).run();
    
    if (result.success) {
      const newShift = await c.env.DB.prepare(`
        SELECT s.*, e.first_name, e.last_name, e.display_name,
               r.name as role_name
        FROM shifts s
        LEFT JOIN employees e ON s.employee_id = e.id
        LEFT JOIN roles r ON s.role_id = r.id
        WHERE s.id = ?
      `).bind(id).first();
      return c.json(success(newShift, 'Shift created successfully'));
    }
    return c.json(error('Failed to create shift'), 500);
  } catch (e) {
    console.error('Shift creation error:', e);
    return c.json(error('Shift creation failed: ' + e.message), 500);
  }
});

// Route de test pour vérifier que CORS fonctionne
app.get('/api/test', async (c) => {
  return c.json(success({ message: 'API OK - CORS is working' }, 'Test endpoint'));
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
