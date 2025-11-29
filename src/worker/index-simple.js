import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// CORS configuration
app.use('/*', cors({
  origin: ['http://localhost:5173', 'https://polpo-direction.pages.dev', 'https://polpo.direction.l-iamani.com'],
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

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
