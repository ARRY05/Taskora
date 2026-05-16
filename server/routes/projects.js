// ============================================================
// routes/projects.js – Project management endpoints
// GET    /api/projects             – list user's projects
// POST   /api/projects             – create project (user → Admin)
// GET    /api/projects/:id         – project detail + members
// POST   /api/projects/:id/members – Admin: add member by email
// DELETE /api/projects/:id/members/:uid – Admin: remove member
// DELETE /api/projects/:id         – Admin: delete project
// ============================================================

const express    = require('express');
const router     = express.Router();
const { initDb } = require('../db');
const auth       = require('../middleware/auth');
const { requireProjectAdmin } = require('../middleware/role');

router.use(auth);

// ── GET /api/projects ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = await initDb();
    const projects = db.prepare(`
      SELECT p.id, p.name, p.description, p.created_at,
             u.name AS created_by_name,
             pm.role AS my_role,
             (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
             (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      JOIN users u ON u.id = p.created_by
      ORDER BY p.created_at DESC
    `).all(req.user.id);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects ────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const db = await initDb();
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required.' });

    const result = db.prepare(
      'INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)'
    ).run(name, description || '', req.user.id);

    // Creator automatically becomes Admin
    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, req.user.id, 'Admin');

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Project created.', project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:id ─────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const db = await initDb();
    const member = db.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Access denied.' });

    const project = db.prepare(`
      SELECT p.*, u.name AS created_by_name, pm.role AS my_role
      FROM projects p
      JOIN users u ON u.id = p.created_by
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      WHERE p.id = ?
    `).get(req.user.id, req.params.id);

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const members = db.prepare(`
      SELECT u.id, u.name, u.email, pm.role, pm.joined_at
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
      ORDER BY pm.role DESC, u.name ASC
    `).all(req.params.id);

    res.json({ ...project, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects/:id/members ────────────────────────
router.post('/:id/members', requireProjectAdmin(req => req.params.id), async (req, res) => {
  try {
    const db = await initDb();

    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const userToAdd = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
    if (!userToAdd) return res.status(404).json({ error: 'No user found with that email.' });

    const already = db.prepare(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(req.params.id, userToAdd.id);
    if (already) return res.status(409).json({ error: 'User is already a project member.' });

    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).run(req.params.id, userToAdd.id, role === 'Admin' ? 'Admin' : 'Member');

    res.status(201).json({ message: `${userToAdd.name} added to project.`, user: userToAdd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/projects/:id/members/:uid ─────────────────
router.delete('/:id/members/:uid', requireProjectAdmin(req => req.params.id), async (req, res) => {
  try {
    const db = await initDb();

    // Prevent removing the last Admin
    const adminCount = db.prepare(
      "SELECT COUNT(*) as c FROM project_members WHERE project_id = ? AND role = 'Admin'"
    ).get(req.params.id).c;
    const targetRole = db.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(req.params.id, req.params.uid);

    if (adminCount === 1 && targetRole && targetRole.role === 'Admin')
      return res.status(400).json({ error: 'Cannot remove the only Admin of the project.' });

    db.prepare(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?'
    ).run(req.params.id, req.params.uid);

    res.json({ message: 'Member removed from project.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/projects/:id ──────────────────────────────
router.delete('/:id', requireProjectAdmin(req => req.params.id), async (req, res) => {
  try {
    const db = await initDb();

    // Delete related records first (no CASCADE in sql.js by default)
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(req.params.id);
    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(req.params.id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

    res.json({ message: 'Project deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
