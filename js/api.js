/**
 * api.js
 * Wrapper for calling Apps Script Web App backend
 * All requests include CONFIG.SECRET for server-side verification
 */

async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('secret', CONFIG.SECRET);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow'
  });
  return await response.json();
}

async function apiPost(action, body = {}) {
  // Note: Apps Script doesn't support custom CORS preflight
  // → use text/plain to avoid preflight, parse JSON on backend
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify({ action, secret: CONFIG.SECRET, ...body }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
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
async function fetchReceiptImage(id, viewerEmail) {
  return apiPost('getReceiptImage', { id, viewerEmail });
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
async function loginWithPassword(payload) {
  return apiPost('login', payload);
}
async function checkUser(email) {
  return apiGet('checkUser', { email });
}
async function setPassword(payload) {
  return apiPost('setPassword', payload);
}
async function requestPasswordReset(payload) {
  return apiPost('requestReset', payload);
}
async function resetPassword(payload) {
  return apiPost('resetPassword', payload);
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
