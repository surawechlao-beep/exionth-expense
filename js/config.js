/**
 * Configuration
 * ⚠️ แก้ค่าด้านล่างนี้หลังจาก deploy Apps Script Web App
 */
const CONFIG = {
  // Apps Script Web App URL (จาก Deploy > Web App)
  // ตัวอย่าง: 'https://script.google.com/macros/s/AKfycbxxxxxxxxx/exec'
  API_URL: 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',

  // ⚠️ ต้องตรงกับ API_SECRET ใน apps-script/Code.gs ทุกตัวอักษร
  // ใช้ random string 32+ ตัวอักษร เช่น สุ่มจาก https://passwordsgenerator.net
  SECRET: 'CHANGE-ME-RANDOM-STRING-Abc123Xyz789KloMno456',

  COMPANY_NAME: 'Exionth Co., Ltd.',
  CURRENCY: 'THB',

  // Auto-detect base URL of this PWA (used for QR code, share links)
  WEB_APP_BASE: window.location.origin + window.location.pathname.replace(/[^/]*$/, '')
};
