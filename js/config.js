/**
 * Configuration
 * Exionth Expense Claim System
 */
const CONFIG = {
  // Apps Script Web App URL
  API_URL: 'https://script.google.com/macros/s/AKfycbyGSypTUw72UuTlHR2TrXUJum82nvH0gQ_KBIV_Oy-qBH-aR0Rf21I5ys_WUjiOIVk7hg/exec',

  // Shared secret — ตรงกับ API_SECRET ใน Code.gs
  SECRET: 'EXIONTH-eKeJ0oCtSq6CHu3kD7RCzF7kMQVaeMO5x8jzicDG',

  COMPANY_NAME: 'Exionth Co., Ltd.',
  CURRENCY: 'THB',

  WEB_APP_BASE: window.location.origin + window.location.pathname.replace(/[^/]*$/, '')
};
