// ============================================================
// projects.js – Project listing, creation, and member management
// ============================================================

// Called by app.js when the Projects section is shown
async function loadProjects() {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary)"><span class="spinner" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--accent)"></span></div>`;

  try {
    const projects = await apiFetch('/projects');

    if (projects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <p>No projects yet. Create your first project!</p>
        </div>`;
      return;
    }

    grid.innerHTML = projects.map(p => `
      <div class="project-card" onclick="openProject(${p.id}, '${escStr(p.name)}', '${p.my_role}')">
        <div class="project-card-header">
          <div class="project-card-name">${p.name}</div>
          ${roleBadge(p.my_role)}
        </div>
        <div class="project-card-desc">${p.description || 'No description provided.'}</div>
        <div class="project-card-meta">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            ${p.task_count} Tasks
          </span>
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            ${p.member_count} Members
          </span>
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${formatDate(p.created_at)}
          </span>
        </div>
      </div>
    `).join('');

  } catch (err) {
    showToast('Failed to load projects: ' + err.message, 'error');
  }
}

// ── Open a project – show detail modal with members ────────
async function openProject(projectId, projectName, myRole) {
  const overlay = document.getElementById('modal-project-detail');
  const titleEl = document.getElementById('project-detail-title');
  const bodyEl  = document.getElementById('project-detail-body');

  titleEl.textContent = projectName;
  overlay.classList.add('open');
  bodyEl.innerHTML = `<div style="text-align:center;padding:24px"><span class="spinner" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--accent)"></span></div>`;

  // Store active project info for member management
  overlay.dataset.projectId = projectId;
  overlay.dataset.myRole    = myRole;

  // Show/hide admin controls
  document.getElementById('btn-add-member').style.display = myRole === 'Admin' ? 'flex' : 'none';

  try {
    const project = await apiFetch(`/projects/${projectId}`);
    renderProjectDetail(project, myRole);
  } catch (err) {
    bodyEl.innerHTML = `<p style="color:var(--priority-high)">${err.message}</p>`;
  }
}

function renderProjectDetail(project, myRole) {
  const bodyEl = document.getElementById('project-detail-body');

  const membersHtml = project.members.map(m => `
    <div class="member-item" id="member-row-${m.id}">
      <div class="member-avatar">${getInitials(m.name)}</div>
      <div style="flex:1">
        <div class="member-name">${m.name}</div>
        <div class="member-email">${m.email}</div>
      </div>
      ${roleBadge(m.role)}
      ${myRole === 'Admin' && m.id !== getUser().id ? `
        <button class="btn btn-danger btn-sm" onclick="removeMember(${project.id}, ${m.id}, '${escStr(m.name)}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      ` : ''}
    </div>
  `).join('');

  bodyEl.innerHTML = `
    <div style="margin-bottom:16px">
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:4px">Description</p>
      <p style="font-size:0.9rem">${project.description || 'No description provided.'}</p>
    </div>
    <div style="margin-bottom:16px">
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:10px;font-weight:600">
        Members (${project.members.length})
      </p>
      <div id="members-list">${membersHtml}</div>
    </div>
    ${myRole === 'Admin' ? `
    <div style="padding-top:12px;border-top:1px solid var(--border)">
      <button class="btn btn-danger btn-sm" onclick="deleteProject(${project.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        Delete Project
      </button>
    </div>
    ` : ''}
  `;
}

// ── Remove a member from project ──────────────────────────
async function removeMember(projectId, userId, userName) {
  if (!confirm(`Remove ${userName} from this project?`)) return;

  try {
    await apiFetch(`/projects/${projectId}/members/${userId}`, 'DELETE');
    showToast(`${userName} removed from project.`, 'success');
    // Refresh detail view
    const project = await apiFetch(`/projects/${projectId}`);
    const myRole  = document.getElementById('modal-project-detail').dataset.myRole;
    renderProjectDetail(project, myRole);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Delete entire project ─────────────────────────────────
async function deleteProject(projectId) {
  if (!confirm('Delete this project? All tasks will be permanently removed.')) return;

  try {
    await apiFetch(`/projects/${projectId}`, 'DELETE');
    showToast('Project deleted.', 'success');
    closeModal('modal-project-detail');
    loadProjects();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Create Project modal ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // New project button
  document.getElementById('btn-new-project').addEventListener('click', () => {
    openModal('modal-create-project');
  });

  // Create project form submit
  document.getElementById('form-create-project').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn  = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating…';

    try {
      await apiFetch('/projects', 'POST', {
        name:        document.getElementById('new-project-name').value.trim(),
        description: document.getElementById('new-project-desc').value.trim()
      });
      showToast('Project created successfully!', 'success');
      closeModal('modal-create-project');
      e.target.reset();
      loadProjects();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Project';
    }
  });

  // Add member button (inside project detail modal)
  document.getElementById('btn-add-member').addEventListener('click', () => {
    const overlay = document.getElementById('modal-project-detail');
    document.getElementById('add-member-project-id').value = overlay.dataset.projectId;
    openModal('modal-add-member');
  });

  // Add member form submit
  document.getElementById('form-add-member').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Adding…';

    const projectId = document.getElementById('add-member-project-id').value;

    try {
      const data = await apiFetch(`/projects/${projectId}/members`, 'POST', {
        email: document.getElementById('add-member-email').value.trim(),
        role:  document.getElementById('add-member-role').value
      });
      showToast(`${data.user.name} added to project.`, 'success');
      closeModal('modal-add-member');
      e.target.reset();

      // Refresh project detail
      const project = await apiFetch(`/projects/${projectId}`);
      const myRole  = document.getElementById('modal-project-detail').dataset.myRole;
      renderProjectDetail(project, myRole);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Member';
    }
  });

});

// ── Modal helpers ─────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close modals when clicking on overlay backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Helper: escape string for HTML attribute
function escStr(s) { return String(s).replace(/'/g, "\\'"); }
