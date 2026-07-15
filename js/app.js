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
 * Render bottom navigation. Pass `active` = one of: home / new / status / inbox
 * Shows Inbox tab only if isGM=true in session.
 */
async function renderBottomNav(active) {
  const session = getSession();
  if (!session) return;

  // Check role (cached in session, refresh in background)
  let role = session.role;
  let isGM = !!session.isGM;
  let isManager = !!session.isManager;
  let isSenior = !!session.isSenior;
  if (typeof session.role === 'undefined') {
    try {
      const r = await fetchMyRole(session.Email);
      role = r.role || 'staff';
      isGM = !!r.isGM;
      isManager = !!r.isManager;
      isSenior = !!r.isSenior;
      session.role = role;
      session.isGM = isGM;
      session.isManager = isManager;
      session.isSenior = isSenior;
      setSession(session);
    } catch { role = 'staff'; }
  }

  document.body.classList.add('has-bottom-nav');
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';

  const items = [
    { key: 'home',   href: 'index.html',  label: 'Home',    icon: 'home' },
    { key: 'new',    href: 'submit.html', label: 'ขอเบิก',  icon: 'plus' },
    { key: 'status', href: 'status.html', label: 'คำขอ',   icon: 'list' }
  ];
  // GM = full inbox / Senior = senior-inbox / Manager = manager-inbox
  if (isGM) {
    items.push({ key: 'inbox', href: 'inbox.html', label: 'Inbox', icon: 'bell' });
  } else if (isSenior) {
    items.push({ key: 'inbox', href: 'senior-inbox.html', label: 'Inbox', icon: 'bell' });
  } else if (isManager) {
    items.push({ key: 'inbox', href: 'manager-inbox.html', label: 'Inbox', icon: 'bell' });
  }
  items.push({ key: 'profile', href: 'profile.html', label: 'Profile', icon: 'user' });

  nav.innerHTML = items.map(it => `
    <a href="${it.href}" class="nav-item ${it.key === active ? 'active' : ''}">
      ${icon(it.icon)}
      <span>${it.label}</span>
    </a>`).join('');
  document.body.appendChild(nav);

  // Async load badge count for Inbox (GM/Senior/Manager)
  if ((isGM || isSenior || isManager) && active !== 'inbox') {
    try {
      const pending = await fetchPendingApprovals(session.Email);
      const count = Array.isArray(pending) ? pending.length : 0;
      if (count > 0) {
        const inboxLink = nav.querySelector('.nav-item[href*="inbox"]');
        if (inboxLink) {
          inboxLink.classList.add('has-badge');
          inboxLink.dataset.badge = count > 99 ? '99+' : count;
        }
      }
    } catch {}
  }
}

// Register service worker (PWA)
/**
 * SignaturePad — lightweight canvas signature
 * Usage:
 *   const sig = new SignaturePad(canvasElement);
 *   sig.isEmpty();           // → true/false
 *   sig.toDataURL();         // → 'data:image/png;base64,...'
 *   sig.clear();
 */
class SignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isDrawing = false;
    this.empty = true;
    this._setup();
  }
  _setup() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#0F172A';
    this.ctx.lineWidth = 2.5;

    const start = e => { this.isDrawing = true; const p = this._pos(e); this.ctx.beginPath(); this.ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const draw = e => {
      if (!this.isDrawing) return;
      const p = this._pos(e);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
      this.empty = false;
      const ph = c.parentElement.querySelector('.sig-placeholder');
      if (ph) ph.style.display = 'none';
      e.preventDefault();
    };
    const end = () => { this.isDrawing = false; };

    c.addEventListener('mousedown', start);
    c.addEventListener('mousemove', draw);
    c.addEventListener('mouseup', end);
    c.addEventListener('mouseout', end);
    c.addEventListener('touchstart', start);
    c.addEventListener('touchmove', draw);
    c.addEventListener('touchend', end);
  }
  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x, y };
  }
  isEmpty() { return this.empty; }
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.empty = true;
    const ph = this.canvas.parentElement.querySelector('.sig-placeholder');
    if (ph) ph.style.display = '';
  }
  toDataURL() {
    return this.canvas.toDataURL('image/png');
  }
}

/**
 * Loading overlay — prevents double-click during async operations
 */
function showLoading(text = 'กำลังประมวลผล...') {
  hideLoading();  // remove any existing
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.id = '__loadingOverlay';
  overlay.innerHTML = `
    <div class="loader-card">
      <div class="spinner"></div>
      <div class="loader-text">${text}</div>
    </div>`;
  document.body.appendChild(overlay);
}
function hideLoading() {
  const o = document.getElementById('__loadingOverlay');
  if (o) o.remove();
}

/**
 * Image Lightbox — fullscreen image viewer with pinch/scroll zoom
 */
function openImageViewer(src, hint = '') {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.id = '__lightbox';
  lb.innerHTML = `
    ${hint ? `<div class="lightbox-hint">${hint}</div>` : ''}
    <button class="lightbox-close" onclick="closeImageViewer()">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
    <img class="lightbox-img" src="${src}" id="__lbImg">
    <div class="lightbox-controls">
      <button onclick="lbZoom(-1)">−</button>
      <button onclick="lbReset()">100%</button>
      <button onclick="lbZoom(1)">+</button>
    </div>`;
  document.body.appendChild(lb);

  const img = document.getElementById('__lbImg');
  let scale = 1, tx = 0, ty = 0;
  let isDragging = false, startX, startY, startTx, startTy;
  let lastTap = 0;
  let initialDist = null, initialScale = 1;

  function apply() {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    img.classList.toggle('zoomed', scale > 1);
  }
  window.lbZoom = (dir) => {
    scale = Math.max(0.5, Math.min(5, scale + dir * 0.3));
    if (scale === 1) { tx = 0; ty = 0; }
    apply();
  };
  window.lbReset = () => { scale = 1; tx = 0; ty = 0; apply(); };

  // Mouse wheel zoom
  lb.addEventListener('wheel', e => {
    e.preventDefault();
    lbZoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  // Double click / double tap to zoom
  img.addEventListener('click', e => {
    const now = Date.now();
    if (now - lastTap < 300) {
      scale = scale > 1 ? 1 : 2;
      if (scale === 1) { tx = 0; ty = 0; }
      apply();
    }
    lastTap = now;
  });

  // Touch pinch zoom
  img.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      initialDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging = true;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      startTx = tx; startTy = ty;
      img.classList.add('dragging');
    }
  });
  img.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && initialDist) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.max(0.5, Math.min(5, initialScale * (d / initialDist)));
      apply();
      e.preventDefault();
    } else if (isDragging && e.touches.length === 1) {
      tx = startTx + (e.touches[0].clientX - startX);
      ty = startTy + (e.touches[0].clientY - startY);
      apply();
      e.preventDefault();
    }
  }, { passive: false });
  img.addEventListener('touchend', () => {
    isDragging = false;
    initialDist = null;
    img.classList.remove('dragging');
  });

  // Mouse drag when zoomed
  img.addEventListener('mousedown', e => {
    if (scale > 1) {
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      startTx = tx; startTy = ty;
      img.classList.add('dragging');
      e.preventDefault();
    }
  });
  document.addEventListener('mousemove', e => {
    if (isDragging) {
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      apply();
    }
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
    if (img) img.classList.remove('dragging');
  });

  // Close on background click
  lb.addEventListener('click', e => {
    if (e.target === lb) closeImageViewer();
  });

  // ESC key
  document.addEventListener('keydown', escHandler);
  function escHandler(e) {
    if (e.key === 'Escape') {
      closeImageViewer();
      document.removeEventListener('keydown', escHandler);
    }
  }
}
function closeImageViewer() {
  const lb = document.getElementById('__lightbox');
  if (lb) lb.remove();
}

function signaturePadHtml(id) {
  return `<div class="sig-box">
    <canvas id="${id}" class="sig-canvas"></canvas>
    <span class="sig-placeholder">เซ็นที่นี่ด้วยนิ้ว / เมาส์</span>
    <div class="sig-actions">
      <span>ลายเซ็น GM</span>
      <button type="button" class="sig-clear" onclick="document.getElementById('${id}').__sig.clear()">ล้าง</button>
    </div>
  </div>`;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err =>
      console.warn('SW registration failed:', err)
    );
  });
}
