import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';

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
    const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM roles').first();
    return c.json(success({
      database: 'connected',
      roles_count: result.count
    }, 'API is healthy'));
  } catch (e) {
    return c.json(error('API health check failed'), 500);
  }
});

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
    return c.json(error('Role creation failed: ' + e.message), 500);
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
    return c.json(error('Failed to fetch employees'), 500);
  }
});

app.post('/api/employees', validator('json'), async (c) => {
  try {
    const { 
      first_name, last_name, display_name, role_id, status = 'active', 
      contract_hours_week, contract_type, is_external = 0, external_category,
      email, phone 
    } = await c.req.json();
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
    return c.json(error('Employee creation failed: ' + e.message), 500);
  }
});

app.put('/api/employees/:id', validator('json'), async (c) => {
  try {
    const id = c.req.param('id');
    const { 
      first_name, last_name, display_name, role_id, status, 
      contract_hours_week, contract_type, is_external, external_category,
      email, phone 
    } = await c.req.json();
    
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
    return c.json(error('Employee deletion failed: ' + e.message), 500);
  }
});

// ===== SHIFT CODES =====
app.get('/api/shift-codes', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM shift_codes ORDER BY code').all();
    return c.json(success(result.results));
  } catch (e) {
    return c.json(error('Failed to fetch shift codes'), 500);
  }
});

app.post('/api/shift-codes', validator('json'), async (c) => {
  try {
    const { 
      code, label, default_color, default_start_midi, default_end_midi,
      default_start_soir, default_end_soir, is_absence = 0, is_rest = 0 
    } = await c.req.json();
    
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
    return c.json(error('Shift code creation failed: ' + e.message), 500);
  }
});

app.put('/api/shift-codes/:code', validator('json'), async (c) => {
  try {
    const code = c.req.param('code');
    const { 
      label, default_color, default_start_midi, default_end_midi,
      default_start_soir, default_end_soir, is_absence, is_rest 
    } = await c.req.json();
    
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
    return c.json(error('Shift code deletion failed: ' + e.message), 500);
  }
});

// ===== TEMPLATES =====
app.get('/api/templates', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT t.*, r.name as role_name,
             (SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT('id', id, 'start_time', start_time, 'end_time', end_time, 'sort_order', sort_order)
              ) FROM template_slots WHERE template_id = t.id ORDER BY sort_order) as slots
      FROM templates t
      LEFT JOIN roles r ON t.role_id = r.id
      ORDER BY r.sort_order, t.name
    `).all();
    
    // Parse JSON slots
    const templates = result.results.map(t => ({
      ...t,
      slots: t.slots ? JSON.parse(t.slots) : []
    }));
    
    return c.json(success(templates));
  } catch (e) {
    return c.json(error('Failed to fetch templates'), 500);
  }
});

app.post('/api/templates', validator('json'), async (c) => {
  try {
    const { name, role_id, service_type, color, slots = [] } = await c.req.json();
    const id = generateUUID();
    
    // Insert template
    const templateResult = await c.env.DB.prepare(`
      INSERT INTO templates (id, name, role_id, service_type, color)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, name, role_id, service_type, color).run();
    
    if (!templateResult.success) {
      return c.json(error('Failed to create template'), 500);
    }
    
    // Insert slots if provided
    if (slots.length > 0) {
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const slotId = generateUUID();
        await c.env.DB.prepare(`
          INSERT INTO template_slots (id, template_id, start_time, end_time, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).bind(slotId, id, slot.start_time, slot.end_time, i).run();
      }
    }
    
    const newTemplate = await c.env.DB.prepare(`
      SELECT t.*, r.name as role_name,
             (SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT('id', id, 'start_time', start_time, 'end_time', end_time, 'sort_order', sort_order)
              ) FROM template_slots WHERE template_id = t.id ORDER BY sort_order) as slots
      FROM templates t
      LEFT JOIN roles r ON t.role_id = r.id
      WHERE t.id = ?
    `).bind(id).first();
    
    const parsedTemplate = {
      ...newTemplate,
      slots: newTemplate.slots ? JSON.parse(newTemplate.slots) : []
    };
    
    return c.json(success(parsedTemplate, 'Template created successfully'));
  } catch (e) {
    return c.json(error('Template creation failed: ' + e.message), 500);
  }
});

app.put('/api/templates/:id', validator('json'), async (c) => {
  try {
    const id = c.req.param('id');
    const { name, role_id, service_type, color, slots = [] } = await c.req.json();
    
    // Update template
    const templateResult = await c.env.DB.prepare(`
      UPDATE templates SET name = ?, role_id = ?, service_type = ?, color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name, role_id, service_type, color, id).run();
    
    if (!templateResult.success) {
      return c.json(error('Failed to update template'), 500);
    }
    
    // Delete existing slots and recreate
    await c.env.DB.prepare('DELETE FROM template_slots WHERE template_id = ?').bind(id).run();
    
    // Insert new slots
    if (slots.length > 0) {
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const slotId = generateUUID();
        await c.env.DB.prepare(`
          INSERT INTO template_slots (id, template_id, start_time, end_time, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).bind(slotId, id, slot.start_time, slot.end_time, i).run();
      }
    }
    
    const updatedTemplate = await c.env.DB.prepare(`
      SELECT t.*, r.name as role_name,
             (SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT('id', id, 'start_time', start_time, 'end_time', end_time, 'sort_order', sort_order)
              ) FROM template_slots WHERE template_id = t.id ORDER BY sort_order) as slots
      FROM templates t
      LEFT JOIN roles r ON t.role_id = r.id
      WHERE t.id = ?
    `).bind(id).first();
    
    const parsedTemplate = {
      ...updatedTemplate,
      slots: updatedTemplate.slots ? JSON.parse(updatedTemplate.slots) : []
    };
    
    return c.json(success(parsedTemplate, 'Template updated successfully'));
  } catch (e) {
    return c.json(error('Template update failed: ' + e.message), 500);
  }
});

app.delete('/api/templates/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const result = await c.env.DB.prepare('DELETE FROM templates WHERE id = ?').bind(id).run();
    
    if (result.success) {
      return c.json(success(null, 'Template deleted successfully'));
    }
    return c.json(error('Failed to delete template'), 500);
  } catch (e) {
    return c.json(error('Template deletion failed: ' + e.message), 500);
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
    return c.json(error('Failed to fetch shifts'), 500);
  }
});

app.post('/api/shifts', validator('json'), async (c) => {
  try {
    const { employee_id, date, role_id, notes, segments = [] } = await c.req.json();
    const id = generateUUID();
    
    // Insert shift
    const shiftResult = await c.env.DB.prepare(`
      INSERT INTO shifts (id, employee_id, date, role_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, employee_id, date, role_id, notes).run();
    
    if (!shiftResult.success) {
      return c.json(error('Failed to create shift'), 500);
    }
    
    // Insert segments
    for (const segment of segments) {
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
    return c.json(error('Shift creation failed: ' + e.message), 500);
  }
});

app.put('/api/shifts/:id', validator('json'), async (c) => {
  try {
    const id = c.req.param('id');
    const { role_id, notes, segments = [] } = await c.req.json();
    
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
    return c.json(error('Failed to fetch absences'), 500);
  }
});

app.post('/api/absences', validator('json'), async (c) => {
  try {
    const { employee_id, start_date, end_date, code, notes } = await c.req.json();
    const id = generateUUID();
    
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
    return c.json(error('Absence creation failed: ' + e.message), 500);
  }
});

app.put('/api/absences/:id', validator('json'), async (c) => {
  try {
    const id = c.req.param('id');
    const { start_date, end_date, code, notes } = await c.req.json();
    
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
    return c.json(error('Absence deletion failed: ' + e.message), 500);
  }
});

// ===== PLANNINGS =====
app.get('/api/plannings', async (c) => {
  try {
    const { week_start, service } = c.req.query();
    
    let query = `
      SELECT p.*, 
             (SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT('id', pr.id, 'employee_id', pr.employee_id, 
                           'employee_name', pr.employee_name, 'employee_role', pr.employee_role,
                           'is_extra', pr.is_extra)
              ) FROM planning_rows pr WHERE pr.planning_id = p.id ORDER BY pr.employee_name) as rows
      FROM plannings p
    `;
    
    const bindings = [];
    const conditions = [];
    
    if (week_start) {
      conditions.push('p.week_start = ?');
      bindings.push(week_start);
    }
    
    if (service) {
      conditions.push('p.service = ?');
      bindings.push(service);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY p.week_start DESC, p.service';
    
    const result = await c.env.DB.prepare(query).bind(...bindings).all();
    
    // Parse JSON rows
    const plannings = result.results.map(p => ({
      ...p,
      rows: p.rows ? JSON.parse(p.rows) : []
    }));
    
    return c.json(success(plannings));
  } catch (e) {
    return c.json(error('Failed to fetch plannings'), 500);
  }
});

app.post('/api/plannings', validator('json'), async (c) => {
  try {
    const { week_start, week_end, service, status = 'active', rows = [] } = await c.req.json();
    const id = generateUUID();
    
    // Insert planning
    const planningResult = await c.env.DB.prepare(`
      INSERT INTO plannings (id, week_start, week_end, service, status)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, week_start, week_end, service, status).run();
    
    if (!planningResult.success) {
      return c.json(error('Failed to create planning'), 500);
    }
    
    // Insert rows if provided
    if (rows.length > 0) {
      for (const row of rows) {
        const rowId = generateUUID();
        await c.env.DB.prepare(`
          INSERT INTO planning_rows (id, planning_id, employee_id, employee_name, employee_role, is_extra)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(rowId, id, row.employee_id, row.employee_name, row.employee_role, row.is_extra || 0).run();
      }
    }
    
    const newPlanning = await c.env.DB.prepare(`
      SELECT p.*, 
             (SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT('id', pr.id, 'employee_id', pr.employee_id, 
                           'employee_name', pr.employee_name, 'employee_role', pr.employee_role,
                           'is_extra', pr.is_extra)
              ) FROM planning_rows pr WHERE pr.planning_id = p.id ORDER BY pr.employee_name) as rows
      FROM plannings p
      WHERE p.id = ?
    `).bind(id).first();
    
    const parsedPlanning = {
      ...newPlanning,
      rows: newPlanning.rows ? JSON.parse(newPlanning.rows) : []
    };
    
    return c.json(success(parsedPlanning, 'Planning created successfully'));
  } catch (e) {
    return c.json(error('Planning creation failed: ' + e.message), 500);
  }
});

app.put('/api/plannings/:id', validator('json'), async (c) => {
  try {
    const id = c.req.param('id');
    const { week_start, week_end, service, status, rows = [] } = await c.req.json();
    
    // Update planning
    const planningResult = await c.env.DB.prepare(`
      UPDATE plannings SET week_start = ?, week_end = ?, service = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(week_start, week_end, service, status, id).run();
    
    if (!planningResult.success) {
      return c.json(error('Failed to update planning'), 500);
    }
    
    // Delete existing rows and recreate
    await c.env.DB.prepare('DELETE FROM planning_rows WHERE planning_id = ?').bind(id).run();
    
    // Insert new rows
    if (rows.length > 0) {
      for (const row of rows) {
        const rowId = generateUUID();
        await c.env.DB.prepare(`
          INSERT INTO planning_rows (id, planning_id, employee_id, employee_name, employee_role, is_extra)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(rowId, id, row.employee_id, row.employee_name, row.employee_role, row.is_extra || 0).run();
      }
    }
    
    const updatedPlanning = await c.env.DB.prepare(`
      SELECT p.*, 
             (SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT('id', pr.id, 'employee_id', pr.employee_id, 
                           'employee_name', pr.employee_name, 'employee_role', pr.employee_role,
                           'is_extra', pr.is_extra)
              ) FROM planning_rows pr WHERE pr.planning_id = p.id ORDER BY pr.employee_name) as rows
      FROM plannings p
      WHERE p.id = ?
    `).bind(id).first();
    
    const parsedPlanning = {
      ...updatedPlanning,
      rows: updatedPlanning.rows ? JSON.parse(updatedPlanning.rows) : []
    };
    
    return c.json(success(parsedPlanning, 'Planning updated successfully'));
  } catch (e) {
    return c.json(error('Planning update failed: ' + e.message), 500);
  }
});

app.delete('/api/plannings/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const result = await c.env.DB.prepare('DELETE FROM plannings WHERE id = ?').bind(id).run();
    
    if (result.success) {
      return c.json(success(null, 'Planning deleted successfully'));
    }
    return c.json(error('Failed to delete planning'), 500);
  } catch (e) {
    return c.json(error('Planning deletion failed: ' + e.message), 500);
  }
});

// ===== WEEKLY DEFAULTS =====
app.get('/api/weekly-defaults', async (c) => {
  try {
    const { employee_id } = c.req.query();
    
    let query = `
      SELECT wd.*, e.first_name, e.last_name, e.display_name,
             t.name as template_name, t.color as template_color
      FROM weekly_defaults wd
      LEFT JOIN employees e ON wd.employee_id = e.id
      LEFT JOIN templates t ON wd.template_id = t.id
    `;
    
    if (employee_id) {
      query += ' WHERE wd.employee_id = ?';
      const result = await c.env.DB.prepare(query).bind(employee_id).all();
      return c.json(success(result.results));
    }
    
    query += ' ORDER BY e.display_name, wd.day_of_week';
    const result = await c.env.DB.prepare(query).all();
    return c.json(success(result.results));
  } catch (e) {
    return c.json(error('Failed to fetch weekly defaults'), 500);
  }
});

app.post('/api/weekly-defaults', validator('json'), async (c) => {
  try {
    const { employee_id, day_of_week, template_id, is_rest = 0, notes } = await c.req.json();
    const id = generateUUID();
    
    const result = await c.env.DB.prepare(`
      INSERT INTO weekly_defaults (id, employee_id, day_of_week, template_id, is_rest, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, employee_id, day_of_week, template_id, is_rest, notes).run();
    
    if (result.success) {
      const newDefault = await c.env.DB.prepare(`
        SELECT wd.*, e.first_name, e.last_name, e.display_name,
               t.name as template_name, t.color as template_color
        FROM weekly_defaults wd
        LEFT JOIN employees e ON wd.employee_id = e.id
        LEFT JOIN templates t ON wd.template_id = t.id
        WHERE wd.id = ?
      `).bind(id).first();
      return c.json(success(newDefault, 'Weekly default created successfully'));
    }
    return c.json(error('Failed to create weekly default'), 500);
  } catch (e) {
    return c.json(error('Weekly default creation failed: ' + e.message), 500);
  }
});

app.put('/api/weekly-defaults/:id', validator('json'), async (c) => {
  try {
    const id = c.req.param('id');
    const { day_of_week, template_id, is_rest, notes } = await c.req.json();
    
    const result = await c.env.DB.prepare(`
      UPDATE weekly_defaults SET day_of_week = ?, template_id = ?, is_rest = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(day_of_week, template_id, is_rest, notes, id).run();
    
    if (result.success) {
      const updatedDefault = await c.env.DB.prepare(`
        SELECT wd.*, e.first_name, e.last_name, e.display_name,
               t.name as template_name, t.color as template_color
        FROM weekly_defaults wd
        LEFT JOIN employees e ON wd.employee_id = e.id
        LEFT JOIN templates t ON wd.template_id = t.id
        WHERE wd.id = ?
      `).bind(id).first();
      return c.json(success(updatedDefault, 'Weekly default updated successfully'));
    }
    return c.json(error('Failed to update weekly default'), 500);
  } catch (e) {
    return c.json(error('Weekly default update failed: ' + e.message), 500);
  }
});

app.delete('/api/weekly-defaults/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const result = await c.env.DB.prepare('DELETE FROM weekly_defaults WHERE id = ?').bind(id).run();
    
    if (result.success) {
      return c.json(success(null, 'Weekly default deleted successfully'));
    }
    return c.json(error('Failed to delete weekly default'), 500);
  } catch (e) {
    return c.json(error('Weekly default deletion failed: ' + e.message), 500);
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
    return c.json(error('Failed to fetch settings'), 500);
  }
});

app.put('/api/settings/:scope/:key', validator('json'), async (c) => {
  try {
    const scope = c.req.param('scope');
    const key = c.req.param('key');
    const { value_json } = await c.req.json();
    
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
    return c.json(error('Failed to fetch audit log'), 500);
  }
});

app.post('/api/audit', validator('json'), async (c) => {
  try {
    const { actor, entity, entity_id, action, payload_json } = await c.req.json();
    const id = generateUUID();
    
    const result = await c.env.DB.prepare(`
      INSERT INTO audit_log (id, actor, entity, entity_id, action, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, actor, entity, entity_id, action, JSON.stringify(payload_json)).run();
    
    if (result.success) {
      const newLog = await c.env.DB.prepare('SELECT * FROM audit_log WHERE id = ?').bind(id).first();
      const parsedLog = {
        ...newLog,
        payload_json: newLog.payload_json ? JSON.parse(newLog.payload_json) : null
      };
      return c.json(success(parsedLog, 'Audit log entry created'));
    }
    return c.json(error('Failed to create audit log entry'), 500);
  } catch (e) {
    return c.json(error('Audit log creation failed: ' + e.message), 500);
  }
});

// ===== BULK OPERATIONS =====
app.post('/api/bulk/shifts', validator('json'), async (c) => {
  try {
    const { shifts } = await c.req.json();
    
    const results = [];
    for (const shiftData of shifts) {
      try {
        const id = generateUUID();
        
        // Insert shift
        await c.env.DB.prepare(`
          INSERT INTO shifts (id, employee_id, date, role_id, notes)
          VALUES (?, ?, ?, ?, ?)
        `).bind(id, shiftData.employee_id, shiftData.date, shiftData.role_id, shiftData.notes).run();
        
        // Insert segments
        for (const segment of shiftData.segments || []) {
          const segmentId = generateUUID();
          await c.env.DB.prepare(`
            INSERT INTO shift_segments (id, shift_id, segment, code, label_override, start_time, end_time, color_override)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(segmentId, id, segment.segment, segment.code, segment.label_override, 
                  segment.start_time, segment.end_time, segment.color_override).run();
        }
        
        results.push({ success: true, id, employee_id: shiftData.employee_id, date: shiftData.date });
      } catch (e) {
        results.push({ success: false, error: e.message, employee_id: shiftData.employee_id, date: shiftData.date });
      }
    }
    
    return c.json(success(results, 'Bulk shifts operation completed'));
  } catch (e) {
    return c.json(error('Bulk shifts operation failed: ' + e.message), 500);
  }
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
