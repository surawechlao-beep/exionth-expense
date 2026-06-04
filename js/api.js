/**
 * api.js
 * Wrapper for calling Apps Script Web App backend
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
  for (let i = 0; i < 3; i++) {
    try {
      const r = await apiPost('getReceiptImage', { id, viewerEmail });
      if (r && !r.error) return r;
      if (r && r.error && r.error.indexOf('Unauthorized') >= 0) return r;
      if (i < 2) await new Promise(s => setTimeout(s, 1500));
      else return r;
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(s => setTimeout(s, 1500));
    }
  }
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

async function fetchAllRequests(email) {
  return apiGet('getAllRequests', { email });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
