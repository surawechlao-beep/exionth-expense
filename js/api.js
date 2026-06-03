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
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify({ action, secret: CONFIG.SECRET, ...body }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await response.json();
}

async function verifyStaff(email) { return apiGet('verifyStaff', { email }); }
async function fetchCategories() { return apiGet('getCategories'); }
async function fetchMyRequests(email) { return apiGet('getMyRequests', { email }); }
async function fetchRequest(id) { return apiGet('getRequest', { id }); }
async function submitExpense(payload) { return apiPost('submit', payload); }
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
