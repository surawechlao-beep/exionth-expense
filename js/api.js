/**
 * api.js v3 — Password auth + Per-Staff Excel
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
    method: 'POST', redirect: 'follow',
    body: JSON.stringify({ action, secret: CONFIG.SECRET, ...body }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return await response.json();
}

// Auth
async function verifyStaff(email) { return apiGet('verifyStaff', { email }); }
async function checkUser(email) { return apiGet('checkUser', { email }); }
async function loginWithPassword(email, password) { return apiPost('login', { email, password }); }
async function setPassword(email, password, confirmPassword) { return apiPost('setPassword', { email, password, confirmPassword }); }
async function requestPasswordReset(email) { return apiPost('requestReset', { email }); }
async function resetPassword(email, token, newPassword, confirmPassword) { return apiPost('resetPassword', { email, token, newPassword, confirmPassword }); }

// Role
async function getMyRole(email) { return apiGet('getMyRole', { email }); }
async function checkIsGM(email) { return apiGet('isGM', { email }); }

// Data
async function fetchCategories() { return apiGet('getCategories'); }
async function fetchMyRequests(email) { return apiGet('getMyRequests', { email }); }
async function fetchRequest(id) { return apiGet('getRequest', { id }); }
async function fetchFuelRate(email) { return apiGet('getFuelRate', { email }); }
async function fetchAllRequests(email) { return apiGet('getAllRequests', { email }); }
async function fetchCustomerHistory(email) { return apiGet('getCustomers', { email }); }
async function fetchManagerInbox(email) { return apiGet('getManagerInbox', { email }); }
async function fetchSeniorInbox(email) { return apiGet('getSeniorInbox', { email }); }
async function fetchMyTeamRequests(email) { return apiGet('getMyTeamRequests', { email }); }
async function fetchMyTeam(email) { return apiGet('getMyTeam', { email }); }
async function fetchPendingApprovals(email) { return apiGet('getPendingApprovals', { email }); }

// Submit
async function submitBatch(payload) { return apiPost('submit', payload); }
async function submitPreApprove(payload) { return apiPost('submitPreApprove', payload); }
async function finalizeClaim(payload) { return apiPost('finalizeClaim', payload); }
async function submitExpense(payload) {
  return apiPost('submit', {
    staffEmail: payload.staffEmail,
    items: [{
      category: payload.category, expenseDate: payload.expenseDate,
      venue: payload.venue, occasion: payload.occasion, attendees: payload.attendees,
      amount: payload.amount, mileageKm: payload.mileageKm,
      receiptBase64: payload.receiptBase64, receiptName: payload.receiptName
    }]
  });
}

// Approval
async function managerApprove(payload) { return apiPost('managerApprove', payload); }
async function seniorApprove(payload) { return apiPost('seniorApprove', payload); }
async function approveRequest(payload) { return apiPost('approve', payload); }

// Excel
async function exportStaffReport(staffEmail, year, month, requesterEmail) {
  return apiPost('exportStaffReport', { staffEmail, year, month, requesterEmail });
}
async function emailStaffReport(staffEmail, year, month, requesterEmail, ccFinance) {
  return apiPost('emailStaffReport', { staffEmail, year, month, requesterEmail, ccFinance });
}

// Receipts
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
