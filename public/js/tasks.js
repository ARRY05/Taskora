// ============================================================
// tasks.js – Task listing, creation, status updates
// ============================================================

// State
let currentProjectId   = null;
let currentProjectRole = null;
let allTasks           = [];
let projectMembers     = [];

// Called by app.js when Tasks section is shown
async function loadTasksSection() {
  // Load projects into the selector dropdown
  try {
    const projects = await apiFetch('/projects');
    const sel = document.getElementById('task-project-select');
    sel.innerHTML = `<option value="">— Select a Project —</option>` +
      projects.map(p => `<option value="${p.id}" data-role="${p.my_role}">${p.name}</option>`).join('');

    // If a project was already selected, re-select it
    if (currentProjectId) {
      sel.value = currentProjectId;
      loadTasksForProject(currentProjectId, currentProjectRole);
    } else {
      document.getElementById('tasks-content').style.display    = 'none';
      document.getElementById('tasks-placeholder').style.display = 'flex';
    }
  } catch (err) {
    showToast('Failed to load projects: ' + err.message, 'error');
  }
}

// On project selection change
document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('task-project-select').addEventListener('change', async (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    currentProjectId   = e.target.value;
    currentProjectRole = opt.dataset.role;

    if (!currentProjectId) {
      document.getElementById('tasks-content').style.display    = 'none';
      document.getElementById('tasks-placeholder').style.display = 'flex';
      return;
    }

    // Show/hide the "New Task" button based on role
    document.getElementById('btn-new-task').style.display =
      currentProjectRole === 'Admin' ? 'flex' : 'none';

    loadTasksForProject(currentProjectId, currentProjectRole);
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTaskTable(btn.dataset.filter);
    });
  });

  // New task button
  document.getElementById('btn-new-task').addEventListener('click', async () => {
    await populateAssigneeDropdown();
    openModal('modal-create-task');
  });

  // Create task form submit
  document.getElementById('form-create-task').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating…';

    try {
      const assignedTo = document.getElementById('task-assigned-to').value;
      await apiFetch('/tasks', 'POST', {
        project_id:  parseInt(currentProjectId),
        title:       document.getElementById('task-title').value.trim(),
        description: document.getElementById('task-description').value.trim(),
        priority:    document.getElementById('task-priority').value,
        status:      document.getElementById('task-status').value,
        due_date:    document.getElementById('task-due-date').value || null,
        assigned_to: assignedTo ? parseInt(assignedTo) : null
      });
      showToast('Task created!', 'success');
      closeModal('modal-create-task');
      e.target.reset();
      loadTasksForProject(currentProjectId, currentProjectRole);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Task';
    }
  });

  // Edit task form submit
  document.getElementById('form-edit-task').addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskId = document.getElementById('edit-task-id').value;
    const btn    = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    try {
      const assignedTo = document.getElementById('edit-task-assigned-to').value;
      await apiFetch(`/tasks/${taskId}`, 'PUT', {
        title:       document.getElementById('edit-task-title').value.trim(),
        description: document.getElementById('edit-task-description').value.trim(),
        priority:    document.getElementById('edit-task-priority').value,
        status:      document.getElementById('edit-task-status').value,
        due_date:    document.getElementById('edit-task-due-date').value || null,
        assigned_to: assignedTo ? parseInt(assignedTo) : null
      });
      showToast('Task updated!', 'success');
      closeModal('modal-edit-task');
      loadTasksForProject(currentProjectId, currentProjectRole);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });

});

// ── Load and display tasks for a project ─────────────────
async function loadTasksForProject(projectId, role) {
  document.getElementById('tasks-content').style.display    = 'block';
  document.getElementById('tasks-placeholder').style.display = 'none';

  const tbody = document.getElementById('tasks-tbody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px"><span class="spinner" style="border-color:rgba(0,0,0,0.12);border-top-color:var(--accent)"></span></td></tr>`;

  try {
    // Load tasks and project members in parallel
    const [tasks, project] = await Promise.all([
      apiFetch(`/tasks?project_id=${projectId}`),
      apiFetch(`/projects/${projectId}`)
    ]);

    allTasks       = tasks;
    projectMembers = project.members;

    // Reset filter to 'All'
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="All"]').classList.add('active');

    renderTaskTable('All');

    // Update task count badge
    document.getElementById('task-count-badge').textContent = tasks.length + ' tasks';

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--priority-high);padding:20px">${err.message}</td></tr>`;
  }
}

// ── Render task table with optional status filter ─────────
function renderTaskTable(filter = 'All') {
  const tbody = document.getElementById('tasks-tbody');
  const user  = getUser();

  const filtered = filter === 'All'
    ? allTasks
    : allTasks.filter(t => t.status === filter);

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:36px;color:var(--text-secondary)">
          No tasks found${filter !== 'All' ? ' for status "' + statusLabel(filter) + '"' : ''}.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const overdue = isOverdue(t.due_date) && t.status !== 'DONE';
    const canEdit = currentProjectRole === 'Admin' || t.assigned_to === user.id;

    return `
      <tr>
        <td style="max-width:200px">
          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}</div>
          ${t.description ? `<div style="font-size:0.76rem;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${t.description}</div>` : ''}
        </td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>
          ${t.assigned_to_name
            ? `<div style="display:flex;align-items:center;gap:6px">
                 <div class="member-avatar" style="width:24px;height:24px;font-size:0.65rem">${getInitials(t.assigned_to_name)}</div>
                 <span style="font-size:0.83rem">${t.assigned_to_name}</span>
               </div>`
            : `<span style="color:var(--text-secondary);font-size:0.82rem">Unassigned</span>`
          }
        </td>
        <td style="font-size:0.83rem;color:${overdue ? 'var(--priority-high)' : 'inherit'}">
          ${formatDate(t.due_date)}
          ${overdue ? '<span style="font-size:0.7rem;font-weight:600;margin-left:4px">Overdue</span>' : ''}
        </td>
        <td style="font-size:0.8rem;color:var(--text-secondary)">${t.created_by_name || '—'}</td>
        <td>
          <div style="display:flex;gap:6px">
            ${canEdit ? `
              <button class="btn btn-outline btn-sm" onclick="openEditTask(${t.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
            ` : ''}
            ${currentProjectRole === 'Admin' ? `
              <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Open Edit Task modal ──────────────────────────────────
async function openEditTask(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('edit-task-id').value          = task.id;
  document.getElementById('edit-task-title').value       = task.title;
  document.getElementById('edit-task-description').value = task.description || '';
  document.getElementById('edit-task-priority').value    = task.priority;
  document.getElementById('edit-task-status').value      = task.status;
  document.getElementById('edit-task-due-date').value    = task.due_date || '';

  // Populate assignee dropdown (Admin sees all members; Member sees only status change)
  if (currentProjectRole === 'Admin') {
    await populateEditAssigneeDropdown(task.assigned_to);
    document.getElementById('edit-task-assigned-to').closest('.form-group').style.display = 'block';
    // Disable non-status fields for member
    ['edit-task-title','edit-task-description','edit-task-priority','edit-task-due-date'].forEach(id => {
      document.getElementById(id).disabled = false;
    });
  } else {
    document.getElementById('edit-task-assigned-to').closest('.form-group').style.display = 'none';
    ['edit-task-title','edit-task-description','edit-task-priority','edit-task-due-date'].forEach(id => {
      document.getElementById(id).disabled = true;
    });
  }

  openModal('modal-edit-task');
}

// ── Populate assignee dropdowns ───────────────────────────
async function populateAssigneeDropdown() {
  const sel = document.getElementById('task-assigned-to');
  sel.innerHTML = `<option value="">— Unassigned —</option>` +
    projectMembers.map(m => `<option value="${m.id}">${m.name} (${m.role})</option>`).join('');
}

async function populateEditAssigneeDropdown(assignedTo) {
  const sel = document.getElementById('edit-task-assigned-to');
  sel.innerHTML = `<option value="">— Unassigned —</option>` +
    projectMembers.map(m =>
      `<option value="${m.id}" ${m.id === assignedTo ? 'selected' : ''}>${m.name} (${m.role})</option>`
    ).join('');
}

// ── Delete a task ─────────────────────────────────────────
async function deleteTask(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!confirm(`Delete task "${task?.title}"? This cannot be undone.`)) return;

  try {
    await apiFetch(`/tasks/${taskId}`, 'DELETE');
    showToast('Task deleted.', 'success');
    loadTasksForProject(currentProjectId, currentProjectRole);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
