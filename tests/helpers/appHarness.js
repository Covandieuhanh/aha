const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function stripExternalResources(html) {
  return html
    .replace(/<link[^>]*fonts\.googleapis[^>]*>/gi, '')
    .replace(/<link[^>]*fonts\.gstatic[^>]*>/gi, '');
}

function bootApp() {
  const htmlPath = path.join(ROOT_DIR, 'index.html');
  const scriptPath = path.join(ROOT_DIR, 'app.js');

  const html = stripExternalResources(fs.readFileSync(htmlPath, 'utf8'));
  const script = fs.readFileSync(scriptPath, 'utf8');

  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });

  dom.window.eval(script);

  return {
    dom,
    window: dom.window,
    document: dom.window.document,
  };
}

function closeApp(ctx) {
  if (ctx && ctx.window) {
    ctx.window.close();
  }
}

function byId(ctx, id) {
  const element = ctx.document.getElementById(id);
  if (!element) {
    throw new Error(`Không tìm thấy phần tử #${id}`);
  }

  return element;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function textOf(element) {
  return normalizeText(element && element.textContent);
}

function setValue(element, value) {
  const eventTarget = element;
  const win = eventTarget.ownerDocument.defaultView;

  eventTarget.value = value;
  eventTarget.dispatchEvent(new win.Event('input', { bubbles: true }));
  eventTarget.dispatchEvent(new win.Event('change', { bubbles: true }));
}

function click(element) {
  const eventTarget = element;
  const win = eventTarget.ownerDocument.defaultView;

  eventTarget.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function submit(formElement) {
  const win = formElement.ownerDocument.defaultView;
  formElement.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
}

function login(ctx, username, password) {
  setValue(byId(ctx, 'login-username'), username);
  setValue(byId(ctx, 'login-password'), password);
  submit(byId(ctx, 'login-form'));
}

function logout(ctx) {
  click(byId(ctx, 'logout-btn'));
}

function getTabButton(ctx, tabId) {
  const button = ctx.document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (!button) {
    throw new Error(`Không tìm thấy tab button ${tabId}`);
  }

  return button;
}

function openTab(ctx, tabId) {
  click(getTabButton(ctx, tabId));
}

function getVisibleTabIds(ctx) {
  return [...ctx.document.querySelectorAll('.tab-btn')]
    .filter((button) => !button.classList.contains('hidden'))
    .map((button) => button.dataset.tab);
}

function monthFromUi(ctx) {
  return byId(ctx, 'visit-month-filter').value || new Date().toISOString().slice(0, 7);
}

function dateInMonth(monthValue, day) {
  const safeDay = String(day).padStart(2, '0');
  return `${monthValue}-${safeDay}`;
}

function selectOptionByLabel(selectElement, matcher, missingLabel) {
  const option = [...selectElement.options].find((item) => matcher(normalizeText(item.textContent)));
  if (!option) {
    throw new Error(missingLabel);
  }

  setValue(selectElement, option.value);
}

function createMember(ctx, { fullName, username, password }) {
  openTab(ctx, 'users');
  setValue(byId(ctx, 'member-full-name'), fullName);
  setValue(byId(ctx, 'member-username'), username);
  setValue(byId(ctx, 'member-password'), password);
  submit(byId(ctx, 'member-form'));
  return textOf(byId(ctx, 'member-form-result'));
}

function setChecked(element, checked) {
  const eventTarget = element;
  const win = eventTarget.ownerDocument.defaultView;
  eventTarget.checked = Boolean(checked);
  eventTarget.dispatchEvent(new win.Event('change', { bubbles: true }));
}

function updateMemberPermissions(ctx, username, permissions) {
  openTab(ctx, 'users');

  const rows = [...byId(ctx, 'user-table-body').querySelectorAll('tr')].filter(
    (row) => !row.querySelector('.empty-cell'),
  );

  const targetRow = rows.find((row) => {
    const usernameCell = row.children[1];
    return usernameCell && textOf(usernameCell) === username;
  });

  if (!targetRow) {
    throw new Error(`Không tìm thấy tài khoản ${username} trong bảng phân quyền`);
  }

  Object.entries(permissions).forEach(([key, value]) => {
    const toggle = targetRow.querySelector(`input.permission-toggle[data-permission="${key}"]`);
    if (!toggle) {
      throw new Error(`Không tìm thấy quyền ${key} cho tài khoản ${username}`);
    }
    setChecked(toggle, value);
  });

  const saveButton = targetRow.querySelector('.save-permissions-btn');
  if (!saveButton) {
    throw new Error(`Không tìm thấy nút lưu quyền cho tài khoản ${username}`);
  }

  click(saveButton);
  return textOf(byId(ctx, 'member-form-result'));
}

function createCustomer(ctx, { name, phone = '' }) {
  openTab(ctx, 'customers');
  setValue(byId(ctx, 'customer-name'), name);
  setValue(byId(ctx, 'customer-phone'), phone);
  submit(byId(ctx, 'customer-form'));
}

function findCustomerRow(ctx, customerName) {
  const rows = getDataRows(ctx, 'customer-table-body');
  const row = rows.find((item) => normalizeText(item.children[0]?.textContent).includes(customerName));
  if (!row) {
    throw new Error(`Không tìm thấy khách hàng ${customerName} trong bảng`);
  }

  return row;
}

function editCustomer(ctx, { currentName, nextName, phone = '', email = '', note = '' }) {
  openTab(ctx, 'customers');
  const row = findCustomerRow(ctx, currentName);
  const editButton = row.querySelector('.edit-customer-btn');
  if (!editButton) {
    throw new Error(`Không có nút sửa cho khách hàng ${currentName}`);
  }

  click(editButton);
  setValue(byId(ctx, 'customer-name'), nextName);
  setValue(byId(ctx, 'customer-phone'), phone);
  setValue(byId(ctx, 'customer-email'), email);
  setValue(byId(ctx, 'customer-note'), note);
  submit(byId(ctx, 'customer-form'));
  return textOf(byId(ctx, 'customer-form-result'));
}

function deleteCustomer(ctx, customerName) {
  openTab(ctx, 'customers');
  const row = findCustomerRow(ctx, customerName);
  const deleteButton = row.querySelector('.delete-customer-btn');
  if (!deleteButton) {
    throw new Error(`Không có nút xoá cho khách hàng ${customerName}`);
  }

  click(deleteButton);
  return textOf(byId(ctx, 'customer-form-result'));
}

function createProduct(ctx, { name, code = '', defaultPrice = 0 }) {
  openTab(ctx, 'products');
  setValue(byId(ctx, 'product-name'), name);
  setValue(byId(ctx, 'product-code'), code);
  setValue(byId(ctx, 'product-default-price'), String(defaultPrice));
  submit(byId(ctx, 'product-form'));
}

function addVisit(ctx, { customerName, productName, date, revenue }) {
  openTab(ctx, 'visits');

  selectOptionByLabel(
    byId(ctx, 'visit-customer'),
    (label) => label.includes(customerName),
    `Không tìm thấy khách hàng ${customerName} trong form tích điểm`,
  );

  selectOptionByLabel(
    byId(ctx, 'visit-product'),
    (label) => label.includes(productName),
    `Không tìm thấy sản phẩm ${productName} trong form tích điểm`,
  );

  setValue(byId(ctx, 'visit-date'), date);
  setValue(byId(ctx, 'visit-revenue'), String(revenue));
  submit(byId(ctx, 'visit-form'));

  return textOf(byId(ctx, 'visit-result'));
}

function addReferral(ctx, { referrerUsername, referredCustomerName, productName, date, revenue }) {
  openTab(ctx, 'referrals');

  if (referrerUsername) {
    selectOptionByLabel(
      byId(ctx, 'referrer-user'),
      (label) => label.includes(`(${referrerUsername})`) || label.includes(referrerUsername),
      `Không tìm thấy người giới thiệu ${referrerUsername}`,
    );
  } else {
    setValue(byId(ctx, 'referrer-user'), '');
  }

  selectOptionByLabel(
    byId(ctx, 'referred-customer'),
    (label) => label.includes(referredCustomerName),
    `Không tìm thấy khách được giới thiệu ${referredCustomerName}`,
  );

  selectOptionByLabel(
    byId(ctx, 'referral-product'),
    (label) => label.includes(productName),
    `Không tìm thấy sản phẩm ${productName} trong form hoa hồng`,
  );

  setValue(byId(ctx, 'referral-date'), date);
  setValue(byId(ctx, 'referral-revenue'), String(revenue));
  submit(byId(ctx, 'referral-form'));

  return textOf(byId(ctx, 'referral-result'));
}

function getDataRows(ctx, tbodyId) {
  const tbody = byId(ctx, tbodyId);

  return [...tbody.querySelectorAll('tr')].filter((row) => !row.querySelector('.empty-cell'));
}

function getRowTexts(ctx, tbodyId) {
  return getDataRows(ctx, tbodyId).map((row) => textOf(row));
}

module.exports = {
  addReferral,
  addVisit,
  bootApp,
  byId,
  click,
  closeApp,
  createCustomer,
  createMember,
  createProduct,
  deleteCustomer,
  dateInMonth,
  editCustomer,
  getDataRows,
  getRowTexts,
  getVisibleTabIds,
  login,
  logout,
  monthFromUi,
  normalizeText,
  openTab,
  setValue,
  updateMemberPermissions,
  textOf,
};
