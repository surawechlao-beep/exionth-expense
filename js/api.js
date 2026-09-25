/**
 * api.js
 * Wrapper for calling Apps Script Web App backend
 * All requests include CONFIG.SECRET for server-side verification
 */

// เน็ตช้า/หลุด → เลิกรอหลัง 45 วิ แทนที่จะค้างถาวร
const API_TIMEOUT_MS = 45000;
const NET_ERROR = 'เชื่อมต่อไม่สำเร็จ — เน็ตอาจไม่เสถียร ข้อมูลที่กรอกยังอยู่ ลองกดใหม่อีกครั้ง';

async function fetchWithTimeout(url, opts = {}, ms = API_TIMEOUT_MS) {
  // ให้ปุ่ม "ยกเลิก" ใน loading overlay สั่งหยุดได้
  const ctrl = new AbortController();
  window.__apiAbort = ctrl;
  const timer = setTimeout(() => ctrl.abort('timeout'), ms);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
  } catch (err) {
    if (err && (err.name === 'AbortError' || String(err).indexOf('abort') >= 0)) {
      throw new Error(NET_ERROR);
    }
    throw new Error(NET_ERROR);
  } finally {
    clearTimeout(timer);
    if (window.__apiAbort === ctrl) window.__apiAbort = null;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  v8.1 แคชฝั่งเครื่อง — "โชว์ของเก่าก่อน แล้วอัปเดตเงียบๆ"
 *
 *  Apps Script มีค่าแรง 1-3 วิต่อคำสั่งที่ลดไม่ได้ (ต้องปลุกสคริปต์ทุกครั้ง)
 *  ทางเดียวที่ทำให้ "รู้สึก" เร็วคือไม่ต้องรอมัน:
 *    เปิดหน้า → วาดจากผลลัพธ์ครั้งก่อนทันที → ยิงขอของสดเบื้องหลัง
 *    → ของสดมา ถ้าต่างจากเดิม ส่งสัญญาณ 'exion:fresh' ให้หน้าวาดใหม่
 *
 *  กันข้อมูลเงินค้าง: ทุกครั้งที่เขียน (apiPost) ล้างแคชทิ้งทั้งหมด
 *  กติกาเดียวกับฝั่งเซิร์ฟเวอร์ — ลืมไม่ได้เพราะอยู่จุดเดียว
 * ═══════════════════════════════════════════════════════════════ */
const CC_PREFIX = 'exc:';
const CC_MAX_BYTES = 250 * 1024;
/* คำสั่งที่แคชได้ (อ่านอย่างเดียว) — ไม่อยู่ในนี้ = ยิงสดเสมอ */
const CC_ACTIONS = {
  // ค่า = อายุที่ "ไม่ต้องยิงใหม่เลย" (ms) · 0 = โชว์ของเก่าแต่ยิงของสดทุกครั้ง
  getHomeData: 0, getMyRequests: 0, getPettyHome: 0, getPettyLedger: 0, getPettyInbox: 0,
  getAccountingQueue: 0, getManagerInbox: 0, getSeniorInbox: 0, getExportApprovalInbox: 0,
  getVisibleRequests: 0, getMyTeamRequests: 0, getAllRequests: 0, getMyExportRequests: 0,
  getPettyMSBC: 0, getPettyBalance: 0,
  getPendingApprovals: 45 * 1000,       // ป้ายตัวเลขบนเมนู — ไม่ต้องยิงใหม่ทุกครั้งที่เปลี่ยนหน้า
  getMyNotifications: 45 * 1000,        // กระดิ่ง
  getPeriodInfo: 5 * 60 * 1000,
  getMyTeam: 10 * 60 * 1000, getExportableStaff: 10 * 60 * 1000,
  getMyRole: 10 * 60 * 1000, getFuelRate: 10 * 60 * 1000, getCustomers: 10 * 60 * 1000,
  getCategories: 24 * 60 * 60 * 1000,   // แทบไม่เปลี่ยน
  getPettyCategories: 24 * 60 * 60 * 1000,
  getMySignature: 24 * 60 * 60 * 1000,
  getSettings: 60 * 60 * 1000
};
function ccKey(action, params) {
  const p = Object.keys(params || {}).sort().map(k => k + '=' + params[k]).join('&');
  return CC_PREFIX + action + '?' + p;
}
function ccGet(action, params) {
  try {
    const raw = localStorage.getItem(ccKey(action, params));
    if (!raw) return null;
    const o = JSON.parse(raw);
    return { data: o.d, age: Date.now() - (o.t || 0) };
  } catch (e) { return null; }
}
function ccPut(action, params, data) {
  try {
    const raw = JSON.stringify({ t: Date.now(), d: data });
    if (raw.length > CC_MAX_BYTES) return;                  // ก้อนใหญ่เกินไม่เก็บ กันเต็ม localStorage
    localStorage.setItem(ccKey(action, params), raw);
  } catch (e) { /* localStorage เต็ม/ปิด — ก็แค่ไม่แคช */ }
}
function ccClear() {
  try {
    const dead = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(CC_PREFIX) === 0) dead.push(k);
    }
    dead.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

/* แถบบางๆ ด้านบนตอนกำลังอัปเดตเบื้องหลัง — ให้รู้ว่าตัวเลขอาจขยับ */
let _ccInflight = 0;
function ccIndicator(on) {
  try {
    _ccInflight = Math.max(0, _ccInflight + (on ? 1 : -1));
    let bar = document.getElementById('swrBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'swrBar';
      bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;width:100%;z-index:9999;pointer-events:none;' +
        'background:linear-gradient(90deg,transparent,#B7081D,transparent);background-size:200% 100%;' +
        'animation:swrSlide 1s linear infinite;opacity:0;transition:opacity .2s;';
      const st = document.createElement('style');
      st.textContent = '@keyframes swrSlide{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(st);
      document.body.appendChild(bar);
    }
    bar.style.opacity = _ccInflight > 0 ? '1' : '0';
  } catch (e) {}
}

/* ตอนวาดซ้ำจากสัญญาณ 'exion:fresh' ห้ามยิงเน็ตซ้อนอีกรอบ */
let _ccReplay = false;

async function apiGetRaw(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('secret', CONFIG.SECRET);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetchWithTimeout(url.toString(), { method: 'GET', redirect: 'follow' });
  return await response.json();
}

async function apiGet(action, params = {}) {
  const ttl = CC_ACTIONS[action];
  if (ttl === undefined) return apiGetRaw(action, params);      // ไม่อยู่ในรายการ = ยิงสดเสมอ

  const cached = ccGet(action, params);
  const revalidate = () => apiGetRaw(action, params).then(d => {
    if (d && !d.error) ccPut(action, params, d);
    return d;
  });

  if (!cached) return revalidate();                              // ครั้งแรก ไม่มีของเก่า ต้องรอ
  if (_ccReplay) return cached.data;                             // วาดซ้ำจากสัญญาณ — ไม่ยิงเน็ต
  if (ttl > 0 && cached.age < ttl) return cached.data;           // ยังสดพอ ไม่ต้องยิง

  // มีของเก่า → คืนทันที แล้วขอของสดเบื้องหลัง
  ccIndicator(true);
  revalidate().then(d => {
    ccIndicator(false);
    if (!d || d.error) return;
    if (JSON.stringify(d) === JSON.stringify(cached.data)) return;   // เหมือนเดิม ไม่ต้องวาดใหม่
    try { window.dispatchEvent(new CustomEvent('exion:fresh', { detail: { action, params, data: d } })); }
    catch (e) {}
  }).catch(() => ccIndicator(false));
  return cached.data;
}

/**
 * ให้หน้าเว็บวาดใหม่เมื่อของสดมา — เรียกครั้งเดียวตอนเปิดหน้า
 *   onFresh(loadFn) : loadFn จะถูกเรียกซ้ำโดยที่ apiGet คืนของจากแคชล้วน ไม่ยิงเน็ตซ้อน
 */
function onFresh(loadFn) {
  window.addEventListener('exion:fresh', async () => {
    _ccReplay = true;
    try { await loadFn(); } finally { _ccReplay = false; }
  });
}

/** โหลดของที่หน้าถัดไปน่าจะใช้ รอไว้ล่วงหน้า — เปิดหน้านั้นแล้วไม่ต้องหมุน */
function prefetch(list) {
  try {
    const run = () => list.forEach(([action, params]) => {
      const c = ccGet(action, params);
      if (c && c.age < 60 * 1000) return;                        // เพิ่งมีมาไม่ถึงนาที ไม่ต้อง
      apiGetRaw(action, params).then(d => { if (d && !d.error) ccPut(action, params, d); }).catch(() => {});
    });
    'requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 2500 }) : setTimeout(run, 800);
  } catch (e) {}
}

async function apiPost(action, body = {}) {
  // Note: Apps Script doesn't support custom CORS preflight
  // → use text/plain to avoid preflight, parse JSON on backend
  // อัปโหลดรูปหลายใบใช้เวลานาน → ให้เวลามากกว่าปกติ
  const heavy = !!(body.items || body.receipts || body.signatureBase64);
  const response = await fetchWithTimeout(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify({ action, secret: CONFIG.SECRET, ...body }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  }, heavy ? 120000 : API_TIMEOUT_MS);
  const out = await response.json();
  // 🔒 เขียนอะไรก็ตามสำเร็จ → ล้างแคชในเครื่องทิ้ง ผู้ใช้จะได้ไม่เห็นยอดเงินเก่า
  const READ_ONLY = { getReceiptImage: 1, exportStaffReport: 1, exportRequestList: 1, exportPettyMSBC: 1,
                      previewPeriod: 1, login: 1, downloadDraftExport: 1, downloadFinalExport: 1 };
  if (!READ_ONLY[action] && out && !out.error) ccClear();
  return out;
}

// --- Specific endpoints ---
// ⚠️ fetchStaff() removed for security — use verifyStaff(email) instead
async function verifyStaff(email) { return apiGet('verifyStaff', { email }); }
async function fetchCategories() { return apiGet('getCategories'); }
async function fetchMyRequests(email) { return apiGet('getMyRequests', { email }); }
async function fetchRequest(id) { return apiGet('getRequest', { id }); }
async function submitExpense(payload) { return apiPost('submit', payload); }
async function submitBatch(payload) { return apiPost('submit', payload); }
async function submitPreApprove(payload) { return apiPost('submitPreApprove', payload); }
async function finalizeClaim(payload) { return apiPost('finalizeClaim', payload); }
async function managerApprove(payload) { return apiPost('managerApprove', payload); }
/** ⚡ ตัดสินหลายใบในคำสั่งเดียว — { ids, decision, remark, approverEmail, signatureBase64, mode } */
async function decideMany(payload) { return apiPost('decideMany', payload); }
async function seniorApprove(payload) { return apiPost('seniorApprove', payload); }
async function fetchManagerInbox(email) { return apiGet('getManagerInbox', { email }); }
async function fetchSeniorInbox(email) { return apiGet('getSeniorInbox', { email }); }
async function fetchMyTeam(email) { return apiGet('getMyTeam', { email }); }
async function fetchMyTeamRequests(email) { return apiGet('getMyTeamRequests', { email }); }
async function fetchAllRequests(email) { return apiGet('getAllRequests', { email }); }
async function fetchMyRole(email) { return apiGet('getMyRole', { email }); }
async function fetchCustomers(email) { return apiGet('getCustomers', { email }); }
async function approveRequest(payload) { return apiPost('approve', payload); }
async function fetchReceiptImage(id, viewerEmail, fileIndex) {
  // fileIndex = ใบเสร็จใบที่เท่าไหร่ (0-based) สำหรับคำขอที่แนบหลายไฟล์
  return apiPost('getReceiptImage', { id, viewerEmail, fileIndex: fileIndex || 0 });
}
// ── v6.0 แจ้งเตือนในแอป (แทนอีเมล) ──
async function fetchNotifications(email) { return apiGet('getMyNotifications', { email }); }
async function markNotifRead(email, id)  { return apiPost('markNotificationRead', { email, id }); }
async function markAllNotifRead(email)   { return apiPost('markNotificationRead', { email, all: true }); }

// ── v6.0 หัวหน้า/GM ล้างรหัสผ่านให้ลูกน้อง (ไม่มีเมล reset แล้ว) ──
async function adminResetPassword(requesterEmail, targetEmail) {
  return apiPost('adminResetPassword', { requesterEmail, targetEmail });
}

// ── v6.0 ปิดลูป: ทำเครื่องหมายว่าจ่ายเงินแล้ว ──
async function fetchUnpaidExports(email) { return apiGet('getUnpaidExports', { email }); }
async function markExportPaid(requesterEmail, exportId) {
  return apiPost('markExportPaid', { requesterEmail, exportId });
}

async function fetchFuelRate(email) {
  return apiGet('getFuelRate', { email });
}
async function fetchPendingApprovals(email) {
  return apiGet('getPendingApprovals', { email });
}
async function checkIsGM(email) {
  return apiGet('isGM', { email });
}
async function exportStaffReport(payload) {
  return apiPost('exportStaffReport', payload);
}
async function emailStaffReport(payload) {
  return apiPost('emailStaffReport', payload);
}
async function loginWithPassword(emailOrPayload, password) {
  if (typeof emailOrPayload === 'object') return apiPost('login', emailOrPayload);
  return apiPost('login', { email: emailOrPayload, password });
}
async function checkUser(email) {
  return apiGet('checkUser', { email });
}
async function setPassword(emailOrPayload, password, confirmPassword) {
  if (typeof emailOrPayload === 'object') return apiPost('setPassword', emailOrPayload);
  return apiPost('setPassword', { email: emailOrPayload, password, confirmPassword });
}
async function requestPasswordReset(emailOrPayload) {
  if (typeof emailOrPayload === 'object') return apiPost('requestReset', emailOrPayload);
  return apiPost('requestReset', { email: emailOrPayload });
}
async function resetPassword(emailOrPayload, token, newPassword, confirmPassword) {
  if (typeof emailOrPayload === 'object') return apiPost('resetPassword', emailOrPayload);
  return apiPost('resetPassword', { email: emailOrPayload, token, newPassword, confirmPassword });
}

// Aliases for backward compatibility (some pages call without 'fetch' prefix)
async function getMyRole(email) { return apiGet('getMyRole', { email }); }
async function fetchCustomerHistory(email) { return apiGet('getCustomers', { email }); }

// ✨ Signature — save once, use everywhere
async function saveSignature(email, signatureBase64) {
  return apiPost('saveSignature', { email, signatureBase64 });
}
async function getMySignature(email) {
  return apiGet('getMySignature', { email });
}

// --- File helpers ---
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/*
 * ⚡ v8.5 ย่อรูปใบเสร็จในเครื่องก่อนส่ง
 *   รูปจากกล้องมือถือ 3–8 MB → ส่งขึ้น Apps Script ทั้งก้อน (บวก 33% จาก base64) → ช้าที่สุดในระบบ
 *   ย่อเหลือกว้าง/สูงไม่เกิน 1,400px JPEG คุณภาพ 0.82 ≈ 150–300 KB — ตัวเลขในบิลยังอ่านชัด
 *   PDF / ไฟล์ที่เล็กอยู่แล้ว / เบราว์เซอร์ที่ย่อไม่ได้ → ส่งต้นฉบับเหมือนเดิม
 */
const IMG_MAX_SIDE = 1400, IMG_QUALITY = 0.82, IMG_SKIP_UNDER = 350 * 1024;
async function fileToBase64(file) {
  try {
    if (!file || !/^image\//.test(file.type || '') || file.size <= IMG_SKIP_UNDER) return await readFileAsDataURL(file);
    if (typeof document === 'undefined' || typeof Image === 'undefined') return await readFileAsDataURL(file);
    const src = await readFileAsDataURL(file);
    // รูปที่เบราว์เซอร์ถอดไม่ได้ (เช่น HEIC บางเครื่อง) หรือถอดไม่เสร็จใน 8 วิ → ส่งต้นฉบับแทน ไม่ค้าง
    const img = await new Promise((res, rej) => {
      const i = new Image(); const t = setTimeout(() => rej(new Error('decode timeout')), 8000);
      i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); rej(new Error('decode failed')); };
      i.src = src;
    });
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return src;
    const scale = Math.min(1, IMG_MAX_SIDE / Math.max(w, h));
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return src;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);      // PNG โปร่งใส → พื้นขาว
    ctx.drawImage(img, 0, 0, cw, ch);
    const out = canvas.toDataURL('image/jpeg', IMG_QUALITY);
    return (out && out.length < src.length) ? out : src;      // ย่อแล้วใหญ่กว่าเดิม (เกิดได้กับรูปเล็ก) → ใช้ต้นฉบับ
  } catch (e) {
    return readFileAsDataURL(file);
  }
}

/* ── 💵 Petty Cash ── */
async function fetchPettyHome(email, fundId)   { return apiGet('getPettyHome', { email, fundId: fundId || '' }); }
async function fetchPettyLedger(email, fundId, scope) { return apiGet('getPettyLedger', { email, fundId: fundId || '', scope: scope || '' }); }
async function fetchPettyInbox(email, fundId)  { return apiGet('getPettyInbox', { email, fundId: fundId || '' }); }
async function fetchPettyCategories()          { return apiGet('getPettyCategories', {}); }
async function submitPetty(payload)            { return apiPost('submitPetty', payload); }
async function approvePetty(payload)           { return apiPost('approvePetty', payload); }
async function payPetty(payload)               { return apiPost('payPetty', payload); }
async function cancelPetty(payload)            { return apiPost('cancelPetty', payload); }
async function requestPettyTopUp(payload)      { return apiPost('requestPettyTopUp', payload); }
async function submitPettyCount(payload)       { return apiPost('submitPettyCount', payload); }
async function fetchPettyMSBC(email, opt) {
  opt = opt || {};
  return apiGet('getPettyMSBC', {
    email, fundId: opt.fundId || '', dateFrom: opt.dateFrom || '', dateTo: opt.dateTo || '',
    includePending: opt.includePending === false ? 'false' : 'true'
  });
}
async function exportPettyMSBC(payload)        { return apiPost('exportPettyMSBC', payload); }
async function setPettyFundConfig(payload)     { return apiPost('setPettyFundConfig', payload); }
async function clearPettyBills(payload)        { return apiPost('clearPettyBills', payload); }
/* ── 🏠 หน้าแรกแยกบทบาท (v8.0) ── */
async function fetchHomeData(email)            { return apiGet('getHomeData', { email }); }
async function fetchAccountingQueue(email)     { return apiGet('getAccountingQueue', { email }); }

/* ── 📋 Export รายการคำขอเป็น Excel ── */
async function fetchExportableStaff(email) { return apiGet('getExportableStaff', { email }); }
async function exportRequestList(payload)  { return apiPost('exportRequestList', payload); }
