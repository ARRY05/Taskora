const { initDb, runQuery } = require('../db');

const ADMIN_ROLE = 'Admin';

function normalizeRole(role) {
  return String(role || '').toUpperCase() === 'ADMIN' ? ADMIN_ROLE : 'Member';
}

async function getProjectRole(projectId, userId) {
  const db = await initDb();
  const { data } = await runQuery(
    db.from('project_members')
      .select('role')
      .eq('project_id', Number(projectId))
      .eq('user_id', Number(userId))
      .maybeSingle()
  );

  return data ? normalizeRole(data.role) : null;
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
