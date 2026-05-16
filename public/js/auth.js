// ============================================================
// auth.js – Login & Signup page logic
// Handles tab switching, form submission, and redirection
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // If already logged in, go straight to the dashboard
  if (isLoggedIn()) {
    window.location.href = '/dashboard.html';
    return;
  }

  const tabLogin  = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const formLogin  = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const errLogin   = document.getElementById('err-login');
  const errSignup  = document.getElementById('err-signup');

  // ── Tab switching ─────────────────────────────────────────
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    formLogin.style.display  = 'block';
    formSignup.style.display = 'none';
    errLogin.style.display   = 'none';
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    formSignup.style.display = 'block';
    formLogin.style.display  = 'none';
    errSignup.style.display  = 'none';
  });

  // ── Login form ────────────────────────────────────────────
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    errLogin.style.display = 'none';

    const btn = formLogin.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in…';

    try {
      const data = await apiFetch('/auth/login', 'POST', {
        email:    document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value
      });

      saveSession(data.token, data.user);
      window.location.href = '/dashboard.html';

    } catch (err) {
      errLogin.textContent   = err.message;
      errLogin.style.display = 'block';
      btn.disabled  = false;
      btn.textContent = 'Sign In';
    }
  });

  // ── Signup form ───────────────────────────────────────────
  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    errSignup.style.display = 'none';

    const password = document.getElementById('signup-password').value;
    const confirm  = document.getElementById('signup-confirm').value;

    if (password !== confirm) {
      errSignup.textContent   = 'Passwords do not match.';
      errSignup.style.display = 'block';
      return;
    }

    const btn = formSignup.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account…';

    try {
      const data = await apiFetch('/auth/signup', 'POST', {
        name:     document.getElementById('signup-name').value.trim(),
        email:    document.getElementById('signup-email').value.trim(),
        password: password
      });

      saveSession(data.token, data.user);
      window.location.href = '/dashboard.html';

    } catch (err) {
      errSignup.textContent   = err.message;
      errSignup.style.display = 'block';
      btn.disabled    = false;
      btn.textContent = 'Create Account';
    }
  });

});
