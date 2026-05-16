const express = require('express');
const router = express.Router();
const { initDb, runQuery } = require('../db');
const auth = require('../middleware/auth');
const { requireProjectAdmin, requireProjectMember } = require('../middleware/role');

router.use(auth);

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];

function validateEnum(value, allowed, field) {
  if (value === undefined || value === null || value === '') return null;
  return allowed.includes(value) ? null : `${field} must be one of: ${allowed.join(', ')}.`;
}

async function getUsersByIds(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await runQuery(
    (await initDb()).from('users').select('id,name,email').in('id', uniqueIds)
  );
  return new Map(data.map(user => [user.id, user]));
}

async function decorateTasks(tasks) {
  const projectIds = [...new Set(tasks.map(task => task.project_id))];
  const userIds = tasks.flatMap(task => [task.assigned_to, task.created_by]).filter(Boolean);
  const userMap = await getUsersByIds(userIds);

  let projectMap = new Map();
  if (projectIds.length) {
    const { data: projects } = await runQuery(
      (await initDb()).from('projects').select('id,name').in('id', projectIds)
    );
    projectMap = new Map(projects.map(project => [project.id, project.name]));
  }

  return tasks.map(task => ({
    ...task,
    project_name: projectMap.get(task.project_id),
    assigned_to_name: userMap.get(task.assigned_to)?.name || null,
    created_by_name: userMap.get(task.created_by)?.name || null,
  }));
}

async function ensureAssigneeIsProjectMember(db, projectId, assignedTo) {
  if (!assignedTo) return null;

  const { data } = await runQuery(
    db.from('project_members')
      .select('id')
      .eq('project_id', Number(projectId))
      .eq('user_id', Number(assignedTo))
      .maybeSingle()
  );

  return data ? null : 'Assigned user is not a member of this project.';
}

router.get('/my', async (req, res) => {
  try {
    const db = await initDb();
    const { data: tasks } = await runQuery(
      db.from('tasks').select('*').eq('assigned_to', req.user.id).order('due_date', { ascending: true })
    );

    res.json(await decorateTasks(tasks));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireProjectMember(req => req.query.project_id), async (req, res) => {
  try {
    const db = await initDb();
    let query = db.from('tasks').select('*').eq('project_id', req.projectId);

    if (req.user.role !== 'ADMIN') {
      query = query.eq('assigned_to', req.user.id);
    }

    const { data: tasks } = await runQuery(query.order('due_date', { ascending: true }));
    const priorityRank = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    tasks.sort((a, b) => (priorityRank[a.priority] || 4) - (priorityRank[b.priority] || 4));

    res.json(await decorateTasks(tasks));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireProjectAdmin(req => req.body.project_id), async (req, res) => {
  try {
    const db = await initDb();
    const { project_id, title, description, priority, status, due_date, assigned_to } = req.body;
    const cleanTitle = String(title || '').trim();

    if (!cleanTitle) return res.status(400).json({ error: 'Task title is required.' });

    const priorityError = validateEnum(priority, VALID_PRIORITIES, 'priority');
    if (priorityError) return res.status(400).json({ error: priorityError });

    const statusError = validateEnum(status, VALID_STATUSES, 'status');
    if (statusError) return res.status(400).json({ error: statusError });

    const assigneeError = await ensureAssigneeIsProjectMember(db, project_id, assigned_to);
    if (assigneeError) return res.status(400).json({ error: assigneeError });

    const { data: task } = await runQuery(
      db.from('tasks')
        .insert({
          project_id: Number(project_id),
          title: cleanTitle,
          description: description || '',
          priority: priority || 'MEDIUM',
          status: status || 'TODO',
          due_date: due_date || null,
          assigned_to: assigned_to || null,
          created_by: req.user.id,
        })
        .select()
        .single()
    );

    const [decorated] = await decorateTasks([task]);
    res.status(201).json({ message: 'Task created.', task: decorated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = await initDb();
    const taskId = Number(req.params.id);

    const { data: task } = await runQuery(
      db.from('tasks').select('*').eq('id', taskId).maybeSingle()
    );
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const { data: membership } = await runQuery(
      db.from('project_members')
        .select('role')
        .eq('project_id', task.project_id)
        .eq('user_id', req.user.id)
        .maybeSingle()
    );
    if (!membership) return res.status(403).json({ error: 'Project access required.' });

    const isAdmin = membership.role === 'Admin' || membership.role === 'ADMIN';
    if (!isAdmin && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Not allowed.' });
    }

    const { title, description, priority, status, due_date, assigned_to } = req.body;
    const statusError = validateEnum(status, VALID_STATUSES, 'status');
    if (statusError) return res.status(400).json({ error: statusError });

    const updates = {};
    if (isAdmin) {
      const priorityError = validateEnum(priority, VALID_PRIORITIES, 'priority');
      if (priorityError) return res.status(400).json({ error: priorityError });

      const assigneeError = await ensureAssigneeIsProjectMember(db, task.project_id, assigned_to);
      if (assigneeError) return res.status(400).json({ error: assigneeError });

      if (title) updates.title = String(title).trim();
      if (description !== undefined) updates.description = description;
      if (priority) updates.priority = priority;
      if (status) updates.status = status;
      if (due_date !== undefined) updates.due_date = due_date || null;
      if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    } else {
      if (!status) return res.status(400).json({ error: 'status is required for member updates.' });
      updates.status = status;
    }

    const { data: updated } = await runQuery(
      db.from('tasks').update(updates).eq('id', taskId).select().single()
    );

    const [decorated] = await decorateTasks([updated]);
    res.json({ message: 'Task updated.', task: decorated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = await initDb();
    const { data: task } = await runQuery(
      db.from('tasks').select('project_id').eq('id', Number(req.params.id)).maybeSingle()
    );
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    req.taskProjectId = task.project_id;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}, requireProjectAdmin(req => req.taskProjectId), async (req, res) => {
  try {
    const db = await initDb();
    await runQuery(db.from('tasks').delete().eq('id', Number(req.params.id)));
    res.json({ message: 'Task deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
