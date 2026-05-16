const { initDb } = require('../db');

const ADMIN_ROLE = 'Admin';

function normalizeRole(role) {
  if (!role) return null;
  return String(role).toUpperCase() === 'ADMIN' ? ADMIN_ROLE : 'Member';
}

async function getProjectRole(projectId, userId) {
  const db = await initDb();
  const membership = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, userId);

  return membership ? normalizeRole(membership.role) : null;
}

function requireProjectMember(resolveProjectId) {
  return async (req, res, next) => {
    try {
      const projectId = resolveProjectId(req);
      if (!projectId) {
        return res.status(400).json({ error: 'project_id is required.' });
      }

      const role = await getProjectRole(projectId, req.user.id);
      if (!role) {
        return res.status(403).json({ error: 'Project access required.' });
      }

      req.projectId = Number(projectId);
      req.user.role = role === ADMIN_ROLE ? 'ADMIN' : 'MEMBER';
      req.projectRole = role;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

function requireProjectAdmin(resolveProjectId) {
  return [
    requireProjectMember(resolveProjectId),
    (req, res, next) => {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      next();
    }
  ];
}

module.exports = {
  ADMIN_ROLE,
  getProjectRole,
  requireProjectAdmin,
  requireProjectMember,
};
