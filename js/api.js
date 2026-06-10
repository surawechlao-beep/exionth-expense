/**
 * api.js v2 — รองรับ multi-tier approval + multi-file
 */

async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('secret', CONFIG.SECRET);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
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

// --- Existing endpoints ---
async function verifyStaff(email) { return apiGet('verifyStaff', { email }); }
async function fetchCategories() { return apiGet('getCategories'); }
async function fetchMyRequests(email) { return apiGet('getMyRequests', { email }); }
async function fetchRequest(id) { return apiGet('getRequest', { id }); }
async function fetchFuelRate(email) { return apiGet('getFuelRate', { email }); }
async function fetchAllRequests(email) { return apiGet('getAllRequests', { email }); }
async function checkIsGM(email) { return apiGet('isGM', { email }); }

// --- NEW v2: Role-based ---
async function getMyRole(email) { return apiGet('getMyRole', { email }); }
async function fetchManagerInbox(email) { return apiGet('getManagerInbox', { email }); }
async function fetchSeniorInbox(email) { return apiGet('getSeniorInbox', { email }); }
async function fetchMyTeamRequests(email) { return apiGet('getMyTeamRequests', { email }); }
async function fetchCustomerHistory(email) { return apiGet('getCustomers', { email }); }
async function fetchPendingApprovals(email) { return apiGet('getPendingApprovals', { email }); }

// --- NEW v2: Submit (multi-item batch) ---
async function submitBatch(payload) { return apiPost('submit', payload); }
async function submitPreApprove(payload) { return apiPost('submitPreApprove', payload); }
async function finalizeClaim(payload) { return apiPost('finalizeClaim', payload); }

// Legacy compat
async function submitExpense(payload) {
  // Convert old single-item format to batch
  return apiPost('submit', {
    staffEmail: payload.staffEmail,
    items: [{
      category: payload.category,
      expenseDate: payload.expenseDate,
      venue: payload.venue,
      occasion: payload.occasion,
      attendees: payload.attendees,
      amount: payload.amount,
      mileageKm: payload.mileageKm,
      receiptBase64: payload.receiptBase64,
      receiptName: payload.receiptName
    }]
  });
}

// --- NEW v2: Two-tier approval ---
async function managerApprove(payload) { return apiPost('managerApprove', payload); }
async function seniorApprove(payload) { return apiPost('seniorApprove', payload); }

// Legacy compat — routes to right level
async function approveRequest(payload) { return apiPost('approve', payload); }

// --- Receipt image (with multi-file support) ---
async function fetchReceiptImage(id, viewerEmail, fileIndex) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await apiPost('getReceiptImage', { id, viewerEmail, fileIndex: fileIndex || 0 });
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

// --- File helper ---
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
