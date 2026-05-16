const express = require('express');
const router = express.Router();
const { initDb, runQuery } = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const db = await initDb();
    const today = new Date().toISOString().split('T')[0];

    const { data: memberships } = await runQuery(
      db.from('project_members').select('project_id').eq('user_id', req.user.id)
    );

    const projectIds = memberships.map(row => row.project_id);
    if (projectIds.length === 0) {
      return res.json({
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 0,
        overdueTasks: 0,
        tasksPerUser: [],
        recentTasks: [],
        totalProjects: 0,
      });
    }

    const { data: tasks } = await runQuery(
      db.from('tasks').select('*').in('project_id', projectIds)
    );

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'DONE').length;
    const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS').length;
    const todoTasks = tasks.filter(task => task.status === 'TODO').length;
    const overdueTasks = tasks.filter(task =>
      task.due_date && task.due_date < today && task.status !== 'DONE'
    ).length;

    const assignedIds = [...new Set(tasks.map(task => task.assigned_to).filter(Boolean))];
    const { data: users } = assignedIds.length
      ? await runQuery(db.from('users').select('id,name,email').in('id', assignedIds))
      : { data: [] };
    const userMap = new Map(users.map(user => [user.id, user]));
    const perUserMap = new Map();

    tasks.forEach(task => {
      if (!task.assigned_to) return;
      const current = perUserMap.get(task.assigned_to) || {
        id: task.assigned_to,
        name: userMap.get(task.assigned_to)?.name || '',
        email: userMap.get(task.assigned_to)?.email || '',
        totalTasks: 0,
        completedTasks: 0,
      };

      current.totalTasks += 1;
      if (task.status === 'DONE') current.completedTasks += 1;
      perUserMap.set(task.assigned_to, current);
    });

    const projectNames = new Map();
    const { data: projects } = await runQuery(
      db.from('projects').select('id,name').in('id', projectIds)
    );
    projects.forEach(project => projectNames.set(project.id, project.name));

    const recentUserIds = [...new Set(tasks.flatMap(task => [task.assigned_to]).filter(Boolean))];
    const recentUserMap = await (async () => {
      if (!recentUserIds.length) return new Map();
      const { data } = await runQuery(db.from('users').select('id,name').in('id', recentUserIds));
      return new Map(data.map(user => [user.id, user.name]));
    })();

    const recentTasks = [...tasks]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        assigned_to_name: recentUserMap.get(task.assigned_to) || null,
        project_name: projectNames.get(task.project_id) || '',
      }));

    res.json({
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      overdueTasks,
      tasksPerUser: [...perUserMap.values()].sort((a, b) => b.totalTasks - a.totalTasks).slice(0, 10),
      recentTasks,
      totalProjects: projectIds.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
