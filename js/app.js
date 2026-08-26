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

/**
 * แปลงค่าวันที่เป็น "YYYY-MM-DD" ตามเวลาไทยเสมอ — ใช้กับ <input type="date">
 *
 * ⚠️ ห้ามใช้ String(v).substr(0,10) กับค่าที่มาจาก server
 *    Apps Script ส่ง Date กลับมาเป็น ISO แบบ UTC เช่น "2026-08-25T17:00:00.000Z"
 *    ซึ่งจริงๆ คือ 26 ส.ค. 07:00 น. เวลาไทย → substr จะได้ 25 ส.ค. คือ "ถอยหลัง 1 วัน"
 *    เคยทำให้วันตัดรอบเลื่อนเองและบิลวันสุดท้ายถูกนับซ้ำ
 */
function toYMD(v) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;          // เป็นรูปแบบที่ต้องการอยู่แล้ว
  const d = new Date(s);
  if (isNaN(d)) return '';
  try {
    // en-CA ให้รูปแบบ YYYY-MM-DD พอดี
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  } catch (e) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
}
function todayYMD() { return toYMD(new Date()); }

function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

/** ชื่อสถานะภาษาไทย — ใช้ร่วมกันทุกหน้า */
const STATUS_TH = {
  pending:    '⏳ รออนุมัติ',
  approved:   '✅ อนุมัติแล้ว',
  rejected:   '❌ ไม่อนุมัติ',
  finalized:  '✓ ส่งบิลแล้ว',
  preapprove: '📋 รออนุมัติงบ'
};
function statusTH(status) {
  return STATUS_TH[String(status || '').toLowerCase()] || (status || '-');
}

function statusBadge(status) {
  const cls = (status || '').toLowerCase();
  return `<span class="badge ${cls}">${statusTH(status)}</span>`;
}

/**
 * ตัดลายเซ็น base64 ที่ต่อท้ายหมายเหตุออก
 * backend เก็บเป็น "อนุมัติแล้ว sig:data:image/png;base64,iVBOR..."
 * ถ้าไม่ตัด พนักงานจะเห็นข้อความขยะยาวเป็นหน้าจอ
 */
function cleanRemark(remark) {
  return String(remark || '').split(' sig:')[0].trim();
}

/** ตัวเลขระยะทาง — backend เขียนชื่อฟิลด์ไม่ตรงกันในบางที่ */
function mileageOf(r) {
  return Number(r.Mileage_KM || r.MileageKm || r.mileageKm || 0) || 0;
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
  try { renderNotifBell(); } catch (e) {}
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';

  const items = [
    { key: 'home',    href: 'index.html',        label: 'หน้าแรก', icon: 'home' },
    { key: 'new',     href: 'submit.html',       label: 'ขอเบิก',  icon: 'plus' },
    { key: 'status',  href: 'status.html',       label: 'คำขอ',    icon: 'list' },
    { key: 'summary', href: 'summary.html',      label: 'สรุป',    emoji: '📊' }
  ];
  // v6.1 ผู้บริหารที่ดูอย่างเดียว (isViewer) ไม่มีกล่องรออนุมัติ
  // GM = full inbox / Senior = senior-inbox / Manager = manager-inbox
  if (isGM) {
    items.push({ key: 'inbox', href: 'inbox.html', label: 'รออนุมัติ', icon: 'bell' });
  } else if (isSenior) {
    items.push({ key: 'inbox', href: 'senior-inbox.html', label: 'รออนุมัติ', icon: 'bell' });
  } else if (isManager) {
    items.push({ key: 'inbox', href: 'manager-inbox.html', label: 'รออนุมัติ', icon: 'bell' });
  }
  items.push({ key: 'profile', href: 'profile.html', label: 'โปรไฟล์', icon: 'user' });

  nav.innerHTML = items.map(it => `
    <a href="${it.href}" class="nav-item ${it.key === active ? 'active' : ''}">
      ${it.emoji ? `<span style="font-size:20px;line-height:1;">${it.emoji}</span>` : icon(it.icon)}
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
      <div class="loader-text" id="__loaderText">${text}</div>
      <button type="button" class="loader-cancel" id="__loaderCancel">ยกเลิก</button>
    </div>`;
  document.body.appendChild(overlay);

  // ปุ่มยกเลิกโผล่หลัง 8 วิ — ถ้าเร็วกว่านั้นไม่ต้องรบกวนสายตา
  const btn = overlay.querySelector('#__loaderCancel');
  setTimeout(() => { if (btn && btn.isConnected) btn.classList.add('show'); }, 8000);
  btn.addEventListener('click', () => {
    if (window.__apiAbort) { try { window.__apiAbort.abort('user'); } catch (e) {} }
    hideLoading();
    showToast('ยกเลิกแล้ว — ข้อมูลที่กรอกยังอยู่', 'error');
  });
}

/** อัปเดตข้อความบน loading overlay ที่เปิดอยู่ (เช่น "กำลังอนุมัติ 4/9") */
function setLoadingText(text) {
  const el = document.getElementById('__loaderText');
  if (el) el.textContent = text;
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

/**
 * อนุมัติ/ปฏิเสธหลายรายการ — บอกความคืบหน้าและสรุปผลตอนจบ
 * ถ้าพังกลางทาง ผู้ใช้ต้องรู้ว่าอันไหนผ่านอันไหนไม่ผ่าน
 * @param {Array} rows   รายการที่จะทำ
 * @param {Function} fn  async (row) => result
 * @param {string} verb  'อนุมัติ' / 'ปฏิเสธ'
 */
async function runBatch(rows, fn, verb) {
  let ok = 0;
  const failed = [];
  showLoading(`กำลัง${verb} 0/${rows.length}...`);
  for (let i = 0; i < rows.length; i++) {
    setLoadingText(`กำลัง${verb} ${i + 1}/${rows.length}...`);
    try {
      const res = await fn(rows[i]);
      if (res && res.error) throw new Error(res.error);
      ok++;
    } catch (err) {
      failed.push({ row: rows[i], msg: err.message });
    }
  }
  hideLoading();
  if (!failed.length) {
    showToast(`✅ ${verb}ครบ ${ok} รายการ`, 'success');
  } else if (ok) {
    showToast(`${verb}สำเร็จ ${ok} · ไม่สำเร็จ ${failed.length} — ${failed[0].msg}`, 'error');
  } else {
    showToast(`${verb}ไม่สำเร็จ — ${failed[0].msg}`, 'error');
  }
  return { ok, failed };
}

/**
 * v6.0 — กระดิ่งแจ้งเตือนใน header
 * ระบบไม่ส่งอีเมลแล้ว ทุกอย่างมาที่นี่ ต้องเห็นชัดและกดง่าย
 */
async function renderNotifBell() {
  const session = getSession();
  if (!session) return;
  const header = document.querySelector('.header');
  if (!header || header.querySelector('.notif-bell')) return;

  const wrap = document.createElement('div');
  wrap.className = 'notif-bell';
  wrap.innerHTML = '<button type="button" aria-label="แจ้งเตือน">🔔<span class="nb-count" style="display:none;">0</span></button>';
  header.appendChild(wrap);

  const panel = document.createElement('div');
  panel.className = 'notif-panel';
  panel.innerHTML = '<div class="np-head"><span>แจ้งเตือน</span><button type="button" class="np-all">อ่านทั้งหมด</button></div><div class="np-body"><div class="np-empty">กำลังโหลด...</div></div>';
  document.body.appendChild(panel);

  const btn = wrap.querySelector('button');
  const badge = wrap.querySelector('.nb-count');
  const body = panel.querySelector('.np-body');
  let data = { unread: 0, items: [] };

  function paint() {
    badge.style.display = data.unread > 0 ? 'flex' : 'none';
    badge.textContent = data.unread > 99 ? '99+' : data.unread;
    if (!data.items.length) {
      body.innerHTML = '<div class="np-empty">🎉 ไม่มีแจ้งเตือน</div>';
      return;
    }
    body.innerHTML = data.items.map(function (n) {
      const when = n.CreatedAt ? timeAgo(new Date(n.CreatedAt)) : '';
      const href = n.Link || '';
      return '<a class="np-item ' + (n.Unread ? 'unread' : '') + '" ' +
        (href ? 'href="' + href + '"' : 'href="javascript:void(0)"') + ' data-id="' + n.ID + '">' +
        '<div class="np-t">' + (n.Title || '') + '</div>' +
        '<div class="np-b">' + (n.Body || '') + '</div>' +
        '<div class="np-w">' + when + '</div></a>';
    }).join('');
  }

  function timeAgo(d) {
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'เมื่อครู่';
    if (mins < 60) return mins + ' นาทีที่แล้ว';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' ชั่วโมงที่แล้ว';
    const days = Math.round(hrs / 24);
    if (days < 7) return days + ' วันที่แล้ว';
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  }

  btn.addEventListener('click', function () {
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) load();
  });
  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && !wrap.contains(e.target)) panel.classList.remove('show');
  });
  panel.querySelector('.np-all').addEventListener('click', async function () {
    try { await markAllNotifRead(session.Email); } catch (err) {}
    data.items.forEach(function (n) { n.Unread = false; });
    data.unread = 0; paint();
  });
  body.addEventListener('click', function (e) {
    const a = e.target.closest('.np-item');
    if (a && a.dataset.id) { try { markNotifRead(session.Email, a.dataset.id); } catch (err) {} }
  });

  async function load() {
    try {
      const r = await fetchNotifications(session.Email);
      if (r && !r.error) { data = r; paint(); }
    } catch (err) { body.innerHTML = '<div class="np-empty">โหลดแจ้งเตือนไม่สำเร็จ</div>'; }
  }
  load();
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
