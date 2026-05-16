const express = require('express');
const router = express.Router();
const { initDb, runQuery } = require('../db');
const auth = require('../middleware/auth');
const { requireProjectAdmin } = require('../middleware/role');

router.use(auth);

async function countByProject(table, projectIds) {
  const counts = new Map(projectIds.map(id => [id, 0]));
  if (projectIds.length === 0) return counts;

  const { data } = await runQuery(
    (await initDb()).from(table).select('project_id').in('project_id', projectIds)
  );
  data.forEach(row => counts.set(row.project_id, (counts.get(row.project_id) || 0) + 1));
  return counts;
}

router.get('/', async (req, res) => {
  try {
    const db = await initDb();
    const { data: memberships } = await runQuery(
      db.from('project_members').select('project_id,role').eq('user_id', req.user.id)
    );

    const projectIds = memberships.map(row => row.project_id);
    if (projectIds.length === 0) return res.json([]);

    const { data: projects } = await runQuery(
      db.from('projects').select('*').in('id', projectIds).order('created_at', { ascending: false })
    );

    const creatorIds = [...new Set(projects.map(project => project.created_by))];
    const { data: creators } = await runQuery(
      db.from('users').select('id,name').in('id', creatorIds)
    );
    const creatorMap = new Map(creators.map(user => [user.id, user.name]));
    const membershipMap = new Map(memberships.map(row => [row.project_id, row.role]));
    const taskCounts = await countByProject('tasks', projectIds);
    const memberCounts = await countByProject('project_members', projectIds);

    res.json(projects.map(project => ({
      ...project,
      created_by_name: creatorMap.get(project.created_by) || '',
      my_role: membershipMap.get(project.id),
      task_count: taskCounts.get(project.id) || 0,
      member_count: memberCounts.get(project.id) || 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = await initDb();
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name) return res.status(400).json({ error: 'Project name is required.' });

    const { data: project } = await runQuery(
      db.from('projects')
        .insert({ name, description, created_by: req.user.id })
        .select()
        .single()
    );

    await runQuery(
      db.from('project_members').insert({
        project_id: project.id,
        user_id: req.user.id,
        role: 'Admin',
      })
    );

    res.status(201).json({ message: 'Project created.', project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = await initDb();
    const projectId = Number(req.params.id);

    const { data: member } = await runQuery(
      db.from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', req.user.id)
        .maybeSingle()
    );
    if (!member) return res.status(403).json({ error: 'Access denied.' });

    const { data: project } = await runQuery(
      db.from('projects').select('*').eq('id', projectId).maybeSingle()
    );
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const { data: creator } = await runQuery(
      db.from('users').select('name').eq('id', project.created_by).maybeSingle()
    );

    const { data: memberRows } = await runQuery(
      db.from('project_members')
        .select('user_id,role,joined_at')
        .eq('project_id', projectId)
        .order('role', { ascending: false })
    );

    const userIds = memberRows.map(row => row.user_id);
    const { data: users } = userIds.length
      ? await runQuery(db.from('users').select('id,name,email').in('id', userIds))
      : { data: [] };
    const userMap = new Map(users.map(user => [user.id, user]));

    const members = memberRows
      .map(row => ({ ...userMap.get(row.user_id), role: row.role, joined_at: row.joined_at }))
      .filter(row => row.id)
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      ...project,
      created_by_name: creator?.name || '',
      my_role: member.role,
      members,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/members', requireProjectAdmin(req => req.params.id), async (req, res) => {
  try {
    const db = await initDb();
    const projectId = Number(req.params.id);
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = req.body.role === 'Admin' ? 'Admin' : 'Member';

    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const { data: userToAdd } = await runQuery(
      db.from('users').select('id,name,email').eq('email', email).maybeSingle()
    );
    if (!userToAdd) return res.status(404).json({ error: 'No user found with that email.' });

    const { data: already } = await runQuery(
      db.from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userToAdd.id)
        .maybeSingle()
    );
    if (already) return res.status(409).json({ error: 'User is already a project member.' });

    await runQuery(db.from('project_members').insert({ project_id: projectId, user_id: userToAdd.id, role }));
    res.status(201).json({ message: `${userToAdd.name} added to project.`, user: userToAdd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/members/:uid', requireProjectAdmin(req => req.params.id), async (req, res) => {
  try {
    const db = await initDb();
    const projectId = Number(req.params.id);
    const userId = Number(req.params.uid);

    const { data: admins } = await runQuery(
      db.from('project_members').select('user_id').eq('project_id', projectId).eq('role', 'Admin')
    );
    const { data: target } = await runQuery(
      db.from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle()
    );

    if (admins.length === 1 && target?.role === 'Admin') {
      return res.status(400).json({ error: 'Cannot remove the only Admin of the project.' });
    }

    await runQuery(
      db.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId)
    );
    res.json({ message: 'Member removed from project.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireProjectAdmin(req => req.params.id), async (req, res) => {
  try {
    const db = await initDb();
    const projectId = Number(req.params.id);

    await runQuery(db.from('tasks').delete().eq('project_id', projectId));
    await runQuery(db.from('project_members').delete().eq('project_id', projectId));
    await runQuery(db.from('projects').delete().eq('id', projectId));

    res.json({ message: 'Project deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
