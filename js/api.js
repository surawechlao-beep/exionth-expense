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

async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('secret', CONFIG.SECRET);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetchWithTimeout(url.toString(), { method: 'GET', redirect: 'follow' });
  return await response.json();
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
  return await response.json();
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
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

/* ── 📋 Export รายการคำขอเป็น Excel ── */
async function fetchExportableStaff(email) { return apiGet('getExportableStaff', { email }); }
async function exportRequestList(payload)  { return apiPost('exportRequestList', payload); }
