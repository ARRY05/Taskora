const express = require('express');
const router = express.Router();
const { initDb } = require('../db');
const auth = require('../middleware/auth');
const { requireProjectAdmin, requireProjectMember } = require('../middleware/role');

router.use(auth);

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];

function validateEnum(value, allowed, field) {
  if (value === undefined || value === null || value === '') return null;
  if (!allowed.includes(value)) {
    return `${field} must be one of: ${allowed.join(', ')}.`;
  }
  return null;
}

async function ensureAssigneeIsProjectMember(db, projectId, assignedTo) {
  if (!assignedTo) return null;

  const isMember = db.prepare(
    'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, assignedTo);

  return isMember ? null : 'Assigned user is not a member of this project.';
}

router.get('/my', async (req, res) => {
  try {
    const db = await initDb();
    const tasks = db.prepare(`
      SELECT t.*, p.name AS project_name,
             u.name AS assigned_to_name,
             c.name AS created_by_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN users c ON c.id = t.created_by
      WHERE t.assigned_to = ?
      ORDER BY t.due_date ASC
    `).all(req.user.id);

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(
  '/',
  requireProjectMember(req => req.query.project_id),
  async (req, res) => {
    try {
      const db = await initDb();
      const params = [req.projectId];
      let scope = 'WHERE t.project_id = ?';

      if (req.user.role !== 'ADMIN') {
        scope += ' AND t.assigned_to = ?';
        params.push(req.user.id);
      }

      const tasks = db.prepare(`
        SELECT t.*, u.name AS assigned_to_name, c.name AS created_by_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assigned_to
        LEFT JOIN users c ON c.id = t.created_by
        ${scope}
        ORDER BY
          CASE t.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
          t.due_date ASC
      `).all(...params);

      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  '/',
  requireProjectAdmin(req => req.body.project_id),
  async (req, res) => {
    try {
      const db = await initDb();
      const { project_id, title, description, priority, status, due_date, assigned_to } = req.body;

      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Task title is required.' });
      }

      const priorityError = validateEnum(priority, VALID_PRIORITIES, 'priority');
      if (priorityError) return res.status(400).json({ error: priorityError });

      const statusError = validateEnum(status, VALID_STATUSES, 'status');
      if (statusError) return res.status(400).json({ error: statusError });

      const assigneeError = await ensureAssigneeIsProjectMember(db, project_id, assigned_to);
      if (assigneeError) return res.status(400).json({ error: assigneeError });

      const result = db.prepare(`
        INSERT INTO tasks (project_id, title, description, priority, status, due_date, assigned_to, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        project_id,
        String(title).trim(),
        description || '',
        priority || 'MEDIUM',
        status || 'TODO',
        due_date || null,
        assigned_to || null,
        req.user.id
      );

      const task = db.prepare(`
        SELECT t.*, u.name AS assigned_to_name, c.name AS created_by_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assigned_to
        LEFT JOIN users c ON c.id = t.created_by
        WHERE t.id = ?
      `).get(result.lastInsertRowid);

      res.status(201).json({ message: 'Task created.', task });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.put('/:id', async (req, res) => {
  try {
    const db = await initDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const membership = db.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(task.project_id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Project access required.' });

    const isAdmin = membership.role === 'Admin' || membership.role === 'ADMIN';

    if (!isAdmin && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Not allowed.' });
    }

    const { title, description, priority, status, due_date, assigned_to } = req.body;
    const statusError = validateEnum(status, VALID_STATUSES, 'status');
    if (statusError) return res.status(400).json({ error: statusError });

    if (isAdmin) {
      const priorityError = validateEnum(priority, VALID_PRIORITIES, 'priority');
      if (priorityError) return res.status(400).json({ error: priorityError });

      const assigneeError = await ensureAssigneeIsProjectMember(db, task.project_id, assigned_to);
      if (assigneeError) return res.status(400).json({ error: assigneeError });

      db.prepare(`
        UPDATE tasks SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          priority = COALESCE(?, priority),
          status = COALESCE(?, status),
          due_date = COALESCE(?, due_date),
          assigned_to = COALESCE(?, assigned_to)
        WHERE id = ?
      `).run(
        title ? String(title).trim() : null,
        description ?? null,
        priority || null,
        status || null,
        due_date || null,
        assigned_to || null,
        req.params.id
      );
    } else {
      if (!status) {
        return res.status(400).json({ error: 'status is required for member updates.' });
      }

      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.id);
    }

    const updated = db.prepare(`
      SELECT t.*, u.name AS assigned_to_name, c.name AS created_by_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN users c ON c.id = t.created_by
      WHERE t.id = ?
    `).get(req.params.id);

    res.json({ message: 'Task updated.', task: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete(
  '/:id',
  async (req, res, next) => {
    try {
      const db = await initDb();
      const task = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found.' });

      req.taskProjectId = task.project_id;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  requireProjectAdmin(req => req.taskProjectId),
  async (req, res) => {
    try {
      const db = await initDb();
      db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
      res.json({ message: 'Task deleted.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
