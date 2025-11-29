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

function success(data, message = 'Success') {
  return { success: true, message, data };
}

function error(message, status = 400) {
  return { success: false, message, status };
}

// ===== DEBUG ENDPOINTS =====
app.get('/api/debug/env', async (c) => {
  try {
    const debug = {
      envKeys: Object.keys(c.env || {}),
      hasDB: !!c.env.DB,
      hasPolpoDirection: !!c.env.polpo_direction,
      envObject: c.env
    };
    return c.json(success(debug, 'Environment debug'));
  } catch (e) {
    return c.json(error('Debug failed: ' + e.message), 500);
  }
});

app.get('/api/health', async (c) => {
  try {
    // Essayer différents noms de binding
    let db = c.env.DB || c.env.polpo_direction;
    
    if (!db) {
      return c.json(error('Database binding not available'), 500);
    }
    
    const result = await db.prepare('SELECT COUNT(*) as count FROM roles').first();
    return c.json(success({
      database: 'connected',
      roles_count: result.count
    }, 'API is healthy'));
  } catch (e) {
    console.error('Health check error:', e);
    return c.json(error('API health check failed: ' + e.message), 500);
  }
});

// ===== BASIC ENDPOINTS =====
app.get('/api/roles', async (c) => {
  try {
    let db = c.env.DB || c.env.polpo_direction;
    
    if (!db) {
      return c.json(error('Database not available'), 500);
    }
    
    const result = await db.prepare('SELECT * FROM roles ORDER BY sort_order, name').all();
    return c.json(success(result.results));
  } catch (e) {
    console.error('Roles fetch error:', e);
    return c.json(error('Failed to fetch roles: ' + e.message), 500);
  }
});

app.post('/api/employees', async (c) => {
  try {
    let db = c.env.DB || c.env.polpo_direction;
    
    if (!db) {
      return c.json(error('Database not available'), 500);
    }
    
    const body = await c.req.json();
    const { first_name, last_name, display_name, role_id } = body;
    const id = crypto.randomUUID();
    
    const result = await db.prepare(`
      INSERT INTO employees (id, first_name, last_name, display_name, role_id, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(id, first_name, last_name, display_name, role_id).run();
    
    if (result.success) {
      const newEmployee = await db.prepare(`
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

app.get('/api/employees', async (c) => {
  try {
    let db = c.env.DB || c.env.polpo_direction;
    
    if (!db) {
      return c.json(error('Database not available'), 500);
    }
    
    const result = await db.prepare(`
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

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
