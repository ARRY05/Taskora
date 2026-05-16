const express = require('express');
const router = express.Router();
const { initDb } = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const myProjects = db.prepare(
      'SELECT project_id FROM project_members WHERE user_id = ?'
    ).all(userId);

    if (myProjects.length === 0) {
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

    const ids = myProjects.map(row => row.project_id);
    const placeholders = ids.map(() => '?').join(',');

    const totalTasks = db.prepare(
      `SELECT COUNT(*) AS c FROM tasks WHERE project_id IN (${placeholders})`
    ).get(...ids).c;

    const statusRows = db.prepare(
      `SELECT status, COUNT(*) AS count
       FROM tasks
       WHERE project_id IN (${placeholders})
       GROUP BY status`
    ).all(...ids);

    const statusCounts = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    statusRows.forEach(row => {
      if (Object.prototype.hasOwnProperty.call(statusCounts, row.status)) {
        statusCounts[row.status] = row.count;
      }
    });

    const overdueTasks = db.prepare(
      `SELECT COUNT(*) AS c FROM tasks
       WHERE project_id IN (${placeholders})
         AND due_date IS NOT NULL
         AND due_date < ?
         AND status != 'DONE'`
    ).get(...ids, today).c;

    const tasksPerUser = db.prepare(
      `SELECT u.id, u.name, u.email,
              COUNT(t.id) AS totalTasks,
              SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS completedTasks
       FROM users u
       JOIN tasks t ON t.assigned_to = u.id
       WHERE t.project_id IN (${placeholders})
       GROUP BY u.id
       ORDER BY totalTasks DESC
       LIMIT 10`
    ).all(...ids);

    const recentTasks = db.prepare(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date,
              u.name AS assigned_to_name, p.name AS project_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.project_id IN (${placeholders})
       ORDER BY t.created_at DESC
       LIMIT 5`
    ).all(...ids);

    res.json({
      totalTasks,
      completedTasks: statusCounts.DONE,
      inProgressTasks: statusCounts.IN_PROGRESS,
      todoTasks: statusCounts.TODO,
      overdueTasks,
      tasksPerUser,
      recentTasks,
      totalProjects: myProjects.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
