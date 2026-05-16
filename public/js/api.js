// ============================================================
// api.js – Shared API utility for all frontend JS files
// Wraps fetch() with JWT auth header and error handling
// ============================================================

const API_BASE = '/api';

/**
 * Make an authenticated API request.
 * @param {string} endpoint  - e.g. '/projects', '/tasks?project_id=1'
 * @param {string} method    - HTTP method (default: 'GET')
 * @param {object} body      - Request body for POST/PUT (optional)
 * @returns {Promise<object>} - Parsed JSON response
 */
async function apiFetch(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('taskora_token');

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data     = await response.json();

  if (!response.ok) {
    // Throw the server error message so callers can show it to users
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

// ── Auth helpers ──────────────────────────────────────────

function saveSession(token, user) {
  localStorage.setItem('taskora_token', token);
  localStorage.setItem('taskora_user',  JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('taskora_token');
  localStorage.removeItem('taskora_user');
}

function getUser() {
  const raw = localStorage.getItem('taskora_user');
  return raw ? JSON.parse(raw) : null;
}

function isLoggedIn() {
  return !!localStorage.getItem('taskora_token');
}

// ── Toast notifications ───────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || ''}<span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Badge / status helpers ────────────────────────────────

function statusBadge(status) {
  const map = {
    TODO:          'badge-todo',
    IN_PROGRESS:   'badge-inprogress',
    DONE:          'badge-done'
  };
  return `<span class="badge ${map[status] || ''}">${statusLabel(status)}</span>`;
}

function priorityBadge(priority) {
  const map = {
    HIGH:   'badge-high',
    MEDIUM: 'badge-medium',
    LOW:    'badge-low'
  };
  return `<span class="badge ${map[priority] || ''}">${priorityLabel(priority)}</span>`;
}

function roleBadge(role) {
  return `<span class="badge ${role === 'Admin' ? 'badge-admin' : 'badge-member'}">${role}</span>`;
}

function statusLabel(status) {
  return {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    DONE: 'Done'
  }[status] || status;
}

function priorityLabel(priority) {
  return {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High'
  }[priority] || priority;
}

// ── Date formatting ───────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

// ── Initials avatar ───────────────────────────────────────

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
