/**
 * app.js
 * Shared client-side logic + lightweight session via localStorage
 */

const SESSION_KEY = 'exionth_session';

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
  catch { return null; }
}

function setSession(staff) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(staff));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function requireLogin() {
  const sess = getSession();
  if (!sess) {
    window.location.href = 'index.html';
    return null;
  }
  return sess;
}

function formatCurrency(n) {
  if (!n && n !== 0) return '-';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function statusBadge(status) {
  const cls = (status || '').toLowerCase();
  const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
  return `<span class="badge ${cls}">${labels[cls] || status}</span>`;
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/**
 * Render bottom navigation. Pass `active` = home / new / status / inbox
 * Shows Inbox tab only if user is GM.
 */
async function renderBottomNav(active) {
  const session = getSession();
  if (!session) return;

  let isGM = !!session.isGM;
  if (typeof session.isGM === 'undefined') {
    try {
      const r = await checkIsGM(session.Email);
      isGM = !!(r && r.isGM);
      session.isGM = isGM;
      setSession(session);
    } catch { isGM = false; }
  }

  document.body.classList.add('has-bottom-nav');
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';

  const items = [
    { key: 'home',   href: 'index.html',  label: 'Home',    icon: 'home' },
    { key: 'new',    href: 'submit.html', label: 'ขอเบิก',  icon: 'plus' },
    { key: 'status', href: 'status.html', label: 'คำขอ',   icon: 'list' }
  ];
  if (isGM) {
    items.push({ key: 'inbox', href: 'inbox.html', label: 'Inbox', icon: 'bell' });
  } else {
    items.push({ key: 'profile', href: '#', label: 'Profile', icon: 'user' });
  }

  nav.innerHTML = items.map(it => `
    <a href="${it.href}" class="nav-item ${it.key === active ? 'active' : ''}">
      ${icon(it.icon)}
      <span>${it.label}</span>
    </a>`).join('');
  document.body.appendChild(nav);

  if (isGM && active !== 'inbox') {
    try {
      const pending = await fetchPendingApprovals(session.Email);
      const count = Array.isArray(pending) ? pending.length : 0;
      if (count > 0) {
        const inboxLink = nav.querySelector('a[href="inbox.html"]');
        if (inboxLink) {
          inboxLink.classList.add('has-badge');
          inboxLink.dataset.badge = count > 99 ? '99+' : count;
        }
      }
    } catch {}
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err =>
      console.warn('SW registration failed:', err)
    );
  });
}
