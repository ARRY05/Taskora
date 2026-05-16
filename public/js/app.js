// ============================================================
// app.js – Main dashboard app: navigation + dashboard stats
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // Guard: redirect to login if not authenticated
  if (!isLoggedIn()) {
    window.location.href = '/';
    return;
  }

  const user = getUser();

  // ── Populate sidebar user info ────────────────────────────
  document.getElementById('sidebar-user-name').textContent  = user.name;
  document.getElementById('sidebar-user-email').textContent = user.email;
  document.getElementById('sidebar-avatar').textContent     = getInitials(user.name);
  document.getElementById('topbar-user-name').textContent   = user.name;

  // ── Logout button ─────────────────────────────────────────
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearSession();
    window.location.href = '/';
  });

  // ── Navigation ────────────────────────────────────────────
  const navItems    = document.querySelectorAll('.nav-item[data-section]');
  const pageSections = document.querySelectorAll('.page-section');

  function showSection(sectionId) {
    pageSections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const target = document.getElementById(`section-${sectionId}`);
    if (target) target.classList.add('active');

    const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (navItem) navItem.classList.add('active');

    document.getElementById('topbar-title').textContent =
      navItem ? navItem.querySelector('span').textContent : 'Dashboard';

    // Load section data
    if (sectionId === 'dashboard') loadDashboard();
    if (sectionId === 'projects')  loadProjects();
    if (sectionId === 'tasks')     loadTasksSection();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => showSection(item.dataset.section));
  });

  // Show dashboard by default
  showSection('dashboard');

  // ── Dashboard Stats ───────────────────────────────────────
  async function loadDashboard() {
    try {
      const data = await apiFetch('/dashboard');

      document.getElementById('stat-total-tasks').textContent    = data.totalTasks;
      document.getElementById('stat-projects').textContent       = data.totalProjects;
      document.getElementById('stat-overdue').textContent        = data.overdueTasks;
      document.getElementById('stat-done').textContent           = data.completedTasks || 0;
      document.getElementById('stat-inprogress').textContent     = data.inProgressTasks || 0;

      // Status bars
      const total = data.totalTasks || 1;
      renderBar('bar-todo',       data.todoTasks       || 0, total, 'todo');
      renderBar('bar-inprogress', data.inProgressTasks || 0, total, 'inprogress');
      renderBar('bar-done',       data.completedTasks  || 0, total, 'done');

      // Tasks per user table
      const tbody = document.getElementById('tasks-per-user-body');
      if (data.tasksPerUser.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:20px">No data yet</td></tr>`;
      } else {
        tbody.innerHTML = data.tasksPerUser.map(u => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="member-avatar" style="width:28px;height:28px;font-size:0.7rem">${getInitials(u.name)}</div>
                <span style="font-weight:500">${u.name}</span>
              </div>
            </td>
            <td>${u.totalTasks}</td>
            <td>${u.completedTasks}</td>
            <td>${u.totalTasks > 0 ? Math.round((u.completedTasks / u.totalTasks) * 100) : 0}%</td>
          </tr>
        `).join('');
      }

      // Recent tasks
      const recentBody = document.getElementById('recent-tasks-body');
      if (data.recentTasks.length === 0) {
        recentBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:20px">No tasks yet</td></tr>`;
      } else {
        recentBody.innerHTML = data.recentTasks.map(t => `
          <tr>
            <td style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.title}</td>
            <td>${t.project_name}</td>
            <td>${priorityBadge(t.priority)}</td>
            <td>${statusBadge(t.status)}</td>
            <td style="color:${isOverdue(t.due_date) && t.status !== 'DONE' ? 'var(--priority-high)' : 'inherit'}">${formatDate(t.due_date)}</td>
          </tr>
        `).join('');
      }

    } catch (err) {
      showToast('Failed to load dashboard: ' + err.message, 'error');
    }
  }

  function renderBar(id, count, total, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.bar-fill').style.width = Math.round((count / total) * 100) + '%';
    el.querySelector('.bar-label span:first-child').textContent = count;
  }

});
