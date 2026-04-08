#!/usr/bin/env node
import process from "node:process";

const BASE_URL = process.env.BASE_URL || "https://localhost:8443";
const ADMIN_IDENTITY = process.env.ADMIN_IDENTITY || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseCookiesFromHeaders(headers) {
  const result = {};
  const setCookies = headers.getSetCookie ? headers.getSetCookie() : [];
  for (const entry of setCookies) {
    const first = entry.split(";")[0];
    const index = first.indexOf("=");
    if (index > 0) {
      result[first.slice(0, index)] = first.slice(index + 1);
    }
  }
  return result;
}

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; ");
}

async function jsonRequest(path, { method = "GET", cookies = {}, body } = {}) {
  const headers = {};
  if (Object.keys(cookies).length > 0) {
    headers.Cookie = cookieHeader(cookies);
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const parsedCookies = parseCookiesFromHeaders(response.headers);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  return { response, payload, parsedCookies, raw: text };
}

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const cookies = {};
  const pageInit = await jsonRequest("/", { method: "GET" });
  Object.assign(cookies, pageInit.parsedCookies);
  assert(cookies.ASP.NET_SessionId, "Khong lay duoc ASP.NET session cookie.");

  const login = await jsonRequest("/api/auth.ashx", {
    method: "POST",
    cookies,
    body: {
      action: "login",
      identity: ADMIN_IDENTITY,
      password: ADMIN_PASSWORD
    }
  });
  Object.assign(cookies, login.parsedCookies);
  assert(login.payload.ok === true, "Dang nhap admin that bai.");
  assert(cookies.dataaha_auth, "Khong nhan duoc auth cookie dataaha_auth.");

  const bootstrap = await jsonRequest("/api/bootstrap.ashx", { method: "GET", cookies });
  assert(bootstrap.payload.ok === true, "Bootstrap that bai sau dang nhap.");
  assert(Array.isArray(bootstrap.payload.products) && bootstrap.payload.products.length > 0, "Khong co san pham de test.");

  const productId = bootstrap.payload.products[0].ProductId;
  const marker = `E2E-${Date.now()}`;

  const customerSave = await jsonRequest("/api/customers.ashx", {
    method: "POST",
    cookies,
    body: {
      action: "save",
      name: `Khach ${marker}`,
      phone: `09${String(Date.now()).slice(-8)}`,
      email: `${marker.toLowerCase()}@example.com`,
      note: marker
    }
  });
  assert(customerSave.payload.ok === true, "Tao khach hang test that bai.");

  const afterCustomer = await jsonRequest("/api/bootstrap.ashx", { method: "GET", cookies });
  const createdCustomer = (afterCustomer.payload.customers || []).find((item) => item.Note === marker);
  assert(createdCustomer && createdCustomer.CustomerId, "Khong tim thay khach hang vua tao.");

  const visitOne = await jsonRequest("/api/visits.ashx", {
    method: "POST",
    cookies,
    body: {
      action: "save",
      customerId: createdCustomer.CustomerId,
      productId,
      visitDate: "2026-04-20",
      revenue: "1000000",
      note: `${marker}-A`
    }
  });
  assert(visitOne.payload.ok === true, "Tao giao dich A that bai.");

  const visitTwo = await jsonRequest("/api/visits.ashx", {
    method: "POST",
    cookies,
    body: {
      action: "save",
      customerId: createdCustomer.CustomerId,
      productId,
      visitDate: "2026-04-02",
      revenue: "1500000",
      note: `${marker}-B`
    }
  });
  assert(visitTwo.payload.ok === true, "Tao giao dich B that bai.");

  const afterTwoVisits = await jsonRequest("/api/bootstrap.ashx", { method: "GET", cookies });
  const customerVisits = (afterTwoVisits.payload.visits || []).filter((item) => item.CustomerId === createdCustomer.CustomerId);
  assert(customerVisits.length === 2, "So luong giao dich sau khi tao khong dung.");

  const visitA = customerVisits.find((item) => item.Note === `${marker}-A`);
  const visitB = customerVisits.find((item) => item.Note === `${marker}-B`);
  assert(visitA && visitB, "Khong tim thay giao dich A/B trong bootstrap.");
  assert(Number(visitB.OccurrenceInMonth) === 1, "Giao dich som hon phai co lan den = 1.");
  assert(Number(visitA.OccurrenceInMonth) === 2, "Giao dich muon hon phai co lan den = 2.");

  const editVisitA = await jsonRequest("/api/visits.ashx", {
    method: "POST",
    cookies,
    body: {
      action: "save",
      visitId: visitA.VisitId,
      customerId: createdCustomer.CustomerId,
      productId,
      visitDate: "2026-04-25",
      revenue: "1100000",
      note: `${marker}-A2`
    }
  });
  assert(editVisitA.payload.ok === true, "Cap nhat giao dich A that bai.");

  const afterEdit = await jsonRequest("/api/bootstrap.ashx", { method: "GET", cookies });
  const afterEditVisits = (afterEdit.payload.visits || []).filter((item) => item.CustomerId === createdCustomer.CustomerId);
  const editedA = afterEditVisits.find((item) => item.Note === `${marker}-A2`);
  const keepB = afterEditVisits.find((item) => item.Note === `${marker}-B`);
  assert(editedA && keepB, "Khong tim thay du lieu sau khi sua giao dich.");
  assert(Number(keepB.OccurrenceInMonth) === 1, "Sau khi sua, giao dich B van phai la lan 1.");
  assert(Number(editedA.OccurrenceInMonth) === 2, "Sau khi sua, giao dich A2 phai la lan 2.");

  const deleteB = await jsonRequest("/api/visits.ashx", {
    method: "POST",
    cookies,
    body: {
      action: "delete",
      visitId: keepB.VisitId
    }
  });
  assert(deleteB.payload.ok === true, "Xoa giao dich B that bai.");

  const afterDelete = await jsonRequest("/api/bootstrap.ashx", { method: "GET", cookies });
  const afterDeleteVisits = (afterDelete.payload.visits || []).filter((item) => item.CustomerId === createdCustomer.CustomerId);
  assert(afterDeleteVisits.length === 1, "Sau khi xoa phai con 1 giao dich.");
  assert(Number(afterDeleteVisits[0].OccurrenceInMonth) === 1, "Giao dich con lai phai duoc reset lan den = 1.");

  console.log("[PASS] E2E auth + bootstrap + visit reorder logic OK");
}

main().catch((error) => {
  console.error("[FAIL]", error && error.message ? error.message : String(error));
  if (error && error.cause) {
    console.error("[CAUSE]", error.cause.message || String(error.cause));
    if (Array.isArray(error.cause.errors)) {
      for (const item of error.cause.errors) {
        console.error("[CAUSE-DETAIL]", item && item.message ? item.message : String(item));
      }
    }
  }
  process.exit(1);
});
