(function () {
  var state = {
    currentUser: null,
    activePanel: "dashboard-panel",
    navItems: [],
    month: currentMonth(),
    customers: [],
    products: [],
    visits: [],
    referrals: [],
    users: [],
    publicPoints: [],
    myPoints: [],
    otpSettings: null,
    otpSettingsLoaded: false
  };

  var refs = {
    authView: document.getElementById("auth-view"),
    appView: document.getElementById("app-view"),
    authMessage: document.getElementById("auth-message"),
    loginIdentity: document.getElementById("login-identity"),
    loginPassword: document.getElementById("login-password"),
    registerName: document.getElementById("register-name"),
    registerPhone: document.getElementById("register-phone"),
    registerOtp: document.getElementById("register-otp"),
    registerPassword: document.getElementById("register-password"),
    resetPhone: document.getElementById("reset-phone"),
    resetOtp: document.getElementById("reset-otp"),
    resetPassword: document.getElementById("reset-password"),
    loginBtn: document.getElementById("login-btn"),
    registerRequestOtpBtn: document.getElementById("register-request-otp-btn"),
    registerBtn: document.getElementById("register-btn"),
    resetRequestOtpBtn: document.getElementById("reset-request-otp-btn"),
    resetBtn: document.getElementById("reset-btn"),
    nav: document.getElementById("app-nav"),
    quickLaunch: document.getElementById("quick-launch"),
    quickGoVisit: document.getElementById("quick-go-visit"),
    quickGoCustomer: document.getElementById("quick-go-customer"),
    quickGoPoint: document.getElementById("quick-go-point"),
    sessionUser: document.getElementById("session-user"),
    logoutBtn: document.getElementById("logout-btn"),
    dashboardCards: document.getElementById("dashboard-cards"),
    customerId: document.getElementById("customer-id"),
    customerName: document.getElementById("customer-name"),
    customerPhone: document.getElementById("customer-phone"),
    customerEmail: document.getElementById("customer-email"),
    customerNote: document.getElementById("customer-note"),
    customerSaveBtn: document.getElementById("customer-save-btn"),
    customerResetBtn: document.getElementById("customer-reset-btn"),
    customerMessage: document.getElementById("customer-message"),
    customerSearch: document.getElementById("customer-search"),
    customerTable: document.getElementById("customer-table"),
    productId: document.getElementById("product-id"),
    productName: document.getElementById("product-name"),
    productCode: document.getElementById("product-code"),
    productPrice: document.getElementById("product-price"),
    productNote: document.getElementById("product-note"),
    productSaveBtn: document.getElementById("product-save-btn"),
    productResetBtn: document.getElementById("product-reset-btn"),
    productMessage: document.getElementById("product-message"),
    productTable: document.getElementById("product-table"),
    visitCustomer: document.getElementById("visit-customer"),
    visitId: document.getElementById("visit-id"),
    visitSearch: document.getElementById("visit-search"),
    visitProduct: document.getElementById("visit-product"),
    visitQuickCustomerToggle: document.getElementById("visit-quick-customer-toggle"),
    visitQuickCustomerBox: document.getElementById("visit-quick-customer-box"),
    visitQuickCustomerName: document.getElementById("visit-quick-customer-name"),
    visitQuickCustomerPhone: document.getElementById("visit-quick-customer-phone"),
    visitQuickProductToggle: document.getElementById("visit-quick-product-toggle"),
    visitQuickProductBox: document.getElementById("visit-quick-product-box"),
    visitQuickProductName: document.getElementById("visit-quick-product-name"),
    visitQuickProductPrice: document.getElementById("visit-quick-product-price"),
    visitReferrer: document.getElementById("visit-referrer"),
    visitDate: document.getElementById("visit-date"),
    visitRevenue: document.getElementById("visit-revenue"),
    visitNote: document.getElementById("visit-note"),
    visitSaveBtn: document.getElementById("visit-save-btn"),
    visitResetBtn: document.getElementById("visit-reset-btn"),
    visitMessage: document.getElementById("visit-message"),
    visitMonth: document.getElementById("visit-month"),
    visitTable: document.getElementById("visit-table"),
    referralMonth: document.getElementById("referral-month"),
    referralTable: document.getElementById("referral-table"),
    pointMember: document.getElementById("point-member"),
    pointValue: document.getElementById("point-value"),
    pointReason: document.getElementById("point-reason"),
    pointPublic: document.getElementById("point-public"),
    pointSaveBtn: document.getElementById("point-save-btn"),
    pointMessage: document.getElementById("point-message"),
    pointsMonth: document.getElementById("points-month"),
    publicPointsTable: document.getElementById("public-points-table"),
    myPointsTable: document.getElementById("my-points-table"),
    myPointsSummary: document.getElementById("my-points-summary"),
    usersTable: document.getElementById("users-table"),
    pointsFormCard: document.getElementById("points-form-card"),
    otpEndpoint: document.getElementById("otp-endpoint"),
    otpApiKey: document.getElementById("otp-api-key"),
    otpSender: document.getElementById("otp-sender"),
    otpTemplate: document.getElementById("otp-template"),
    otpHttpMethod: document.getElementById("otp-http-method"),
    otpParamList: document.getElementById("otp-param-list"),
    otpAddParamBtn: document.getElementById("otp-add-param-btn"),
    otpDevMode: document.getElementById("otp-dev-mode"),
    otpSaveBtn: document.getElementById("otp-save-btn"),
    otpSettingsMessage: document.getElementById("otp-settings-message")
  };
  var quickReasonButtons = Array.prototype.slice.call(document.querySelectorAll(".quick-reason-btn"));

  var authSwitches = Array.prototype.slice.call(document.querySelectorAll(".auth-switch"));
  var authPanels = {
    "login-panel": document.getElementById("login-panel"),
    "register-panel": document.getElementById("register-panel"),
    "reset-panel": document.getElementById("reset-panel")
  };

  function currentMonth() {
    var now = new Date();
    var month = String(now.getMonth() + 1);
    if (month.length < 2) month = "0" + month;
    return now.getFullYear() + "-" + month;
  }

  function readActivePanel() {
    try {
      return window.localStorage.getItem("dataaha.activePanel") || "dashboard-panel";
    } catch (error) {
      return "dashboard-panel";
    }
  }

  function persistActivePanel(panelId) {
    try {
      window.localStorage.setItem("dataaha.activePanel", panelId);
    } catch (error) {
      return;
    }
  }

  function readLastVisitPreset() {
    try {
      return {
        customerId: window.localStorage.getItem("dataaha.visit.customerId") || "",
        productId: window.localStorage.getItem("dataaha.visit.productId") || "",
        referrerUserId: window.localStorage.getItem("dataaha.visit.referrerUserId") || ""
      };
    } catch (error) {
      return { customerId: "", productId: "", referrerUserId: "" };
    }
  }

  function persistLastVisitPreset(customerId, productId, referrerUserId) {
    try {
      window.localStorage.setItem("dataaha.visit.customerId", customerId || refs.visitCustomer.value || "");
      window.localStorage.setItem("dataaha.visit.productId", productId || refs.visitProduct.value || "");
      window.localStorage.setItem("dataaha.visit.referrerUserId", referrerUserId || refs.visitReferrer.value || "");
    } catch (error) {
      return;
    }
  }

  function api(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body || {})
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.message || "Có lỗi xảy ra.");
        }
        return payload;
      });
    });
  }

  function getJson(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.message || "Có lỗi xảy ra.");
        }
        return payload;
      });
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cell(label, content, extraClass) {
    var className = extraClass ? " class=\"" + extraClass + "\"" : "";
    return "<td" + className + " data-label=\"" + escapeHtml(label) + "\">" + content + "</td>";
  }

  function emptyRow(colspan, message) {
    return "<tr><td class=\"empty-cell\" colspan=\"" + colspan + "\">" + escapeHtml(message) + "</td></tr>";
  }

  function actionGroup(buttons) {
    return "<div class=\"inline-actions\">" + buttons.join("") + "</div>";
  }

  function formatMoney(value) {
    var number = Number(value || 0);
    return number.toLocaleString("vi-VN") + " đ";
  }

  function formatDate(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
  }

  function formatRole(roleKey) {
    if (roleKey === "admin") return "Quản trị";
    if (roleKey === "operator") return "Điều hành";
    if (roleKey === "member") return "Thành viên";
    return roleKey || "";
  }

  function defaultOtpParamPairs() {
    return [
      { key: "loginName", value: "" },
      { key: "sign", value: "" },
      { key: "serviceTypeId", value: "" },
      { key: "phoneNumber", value: "{phoneNumber}" },
      { key: "message", value: "{message}" },
      { key: "brandName", value: "{brandName}" }
    ];
  }

  function normalizedOtpSettings(settings) {
    var source = settings || {};
    var pairs = Array.isArray(source.paramPairs) ? source.paramPairs : [];
    if (!pairs.length) {
      pairs = defaultOtpParamPairs();
    }
    return {
      endpoint: source.endpoint || "",
      apiKey: source.apiKey || "",
      sender: source.sender || "",
      template: source.template || "Mã OTP của bạn là: {OTP}",
      httpMethod: source.httpMethod === "POST" ? "POST" : "GET",
      isDevMode: !!source.isDevMode,
      paramPairs: pairs.map(function (item) {
        return {
          key: item && item.key ? String(item.key) : "",
          value: item && item.value ? String(item.value) : ""
        };
      })
    };
  }

  function collectOtpParamPairs() {
    if (!refs.otpParamList) return [];
    var rows = Array.prototype.slice.call(refs.otpParamList.querySelectorAll(".otp-param-row"));
    return rows.map(function (row) {
      var keyInput = row.querySelector(".otp-param-key");
      var valueInput = row.querySelector(".otp-param-value");
      return {
        key: keyInput ? keyInput.value.trim() : "",
        value: valueInput ? valueInput.value.trim() : ""
      };
    }).filter(function (item) {
      return item.key !== "";
    });
  }

  function renderOtpParamRows(pairs) {
    if (!refs.otpParamList) return;
    var rows = Array.isArray(pairs) && pairs.length ? pairs : defaultOtpParamPairs();
    refs.otpParamList.innerHTML = rows.map(function (item, index) {
      return "<div class=\"otp-param-row\" data-index=\"" + index + "\">" +
        "<label>Key<input type=\"text\" class=\"otp-param-key\" value=\"" + escapeHtml(item.key || "") + "\" /></label>" +
        "<label>Value<input type=\"text\" class=\"otp-param-value\" value=\"" + escapeHtml(item.value || "") + "\" /></label>" +
        "<button type=\"button\" class=\"secondary-btn danger-btn\" data-action=\"remove-otp-param\">Xóa</button>" +
        "</div>";
    }).join("");
  }

  function renderOtpSettings() {
    if (!refs.otpEndpoint) return;
    var settings = normalizedOtpSettings(state.otpSettings);
    refs.otpEndpoint.value = settings.endpoint;
    refs.otpApiKey.value = settings.apiKey;
    refs.otpSender.value = settings.sender;
    refs.otpTemplate.value = settings.template;
    refs.otpHttpMethod.value = settings.httpMethod;
    refs.otpDevMode.checked = settings.isDevMode;
    renderOtpParamRows(settings.paramPairs);
  }

  function loadOtpSettings(forceRefresh) {
    if (!state.currentUser || state.currentUser.RoleKey !== "admin") {
      return Promise.resolve();
    }
    if (!forceRefresh && state.otpSettingsLoaded && state.otpSettings) {
      renderOtpSettings();
      return Promise.resolve();
    }
    return api("/api/otp-settings.ashx", { action: "get" }).then(function (payload) {
      state.otpSettings = normalizedOtpSettings(payload.settings || {});
      state.otpSettingsLoaded = true;
      refs.otpSettingsMessage.textContent = "";
      renderOtpSettings();
    }).catch(function (error) {
      refs.otpSettingsMessage.textContent = error.message;
    });
  }

  function saveOtpSettings() {
    var paramPairs = collectOtpParamPairs();
    api("/api/otp-settings.ashx", {
      action: "save",
      endpoint: refs.otpEndpoint.value,
      apiKey: refs.otpApiKey.value,
      sender: refs.otpSender.value,
      template: refs.otpTemplate.value,
      httpMethod: refs.otpHttpMethod.value,
      isDevMode: refs.otpDevMode.checked,
      paramPairs: paramPairs
    }).then(function (payload) {
      state.otpSettings = normalizedOtpSettings(payload.settings || {});
      state.otpSettingsLoaded = true;
      renderOtpSettings();
      refs.otpSettingsMessage.textContent = payload.message || "Đã lưu cấu hình OTP.";
    }).catch(function (error) {
      refs.otpSettingsMessage.textContent = error.message;
    });
  }

  function setAuthMessage(message) {
    refs.authMessage.textContent = message || "";
  }

  function bindAuthSwitcher() {
    authSwitches.forEach(function (button) {
      button.addEventListener("click", function () {
        var panelId = button.getAttribute("data-auth-panel");
        authSwitches.forEach(function (item) {
          item.classList.toggle("active", item === button);
        });
        Object.keys(authPanels).forEach(function (key) {
          authPanels[key].classList.toggle("hidden", key !== panelId);
        });
        setAuthMessage("");
      });
    });
  }

  function bindEvents() {
    bindAuthSwitcher();
    refs.loginBtn.addEventListener("click", login);
    refs.registerRequestOtpBtn.addEventListener("click", requestRegisterOtp);
    refs.registerBtn.addEventListener("click", register);
    refs.resetRequestOtpBtn.addEventListener("click", requestResetOtp);
    refs.resetBtn.addEventListener("click", resetPassword);
    refs.logoutBtn.addEventListener("click", logout);
    refs.quickGoVisit.addEventListener("click", function () {
      switchPanel("visits-panel", true);
      setTimeout(function () { refs.visitCustomer.focus(); }, 120);
    });
    refs.quickGoCustomer.addEventListener("click", function () {
      switchPanel("customers-panel", true);
      setTimeout(function () { refs.customerName.focus(); }, 120);
    });
    refs.quickGoPoint.addEventListener("click", function () {
      switchPanel("points-panel", true);
      setTimeout(function () {
        if (state.currentUser && (state.currentUser.RoleKey === "admin" || state.currentUser.RoleKey === "operator")) {
          refs.pointMember.focus();
        } else {
          refs.pointsMonth.focus();
        }
      }, 120);
    });
    refs.customerSaveBtn.addEventListener("click", saveCustomer);
    refs.customerResetBtn.addEventListener("click", resetCustomerForm);
    refs.customerSearch.addEventListener("input", renderCustomers);
    refs.productSaveBtn.addEventListener("click", saveProduct);
    refs.productResetBtn.addEventListener("click", resetProductForm);
    refs.visitSaveBtn.addEventListener("click", saveVisit);
    refs.visitResetBtn.addEventListener("click", resetVisitForm);
    refs.visitSearch.addEventListener("input", renderVisits);
    refs.visitProduct.addEventListener("change", handleVisitProductChanged);
    refs.visitQuickCustomerToggle.addEventListener("click", function () {
      toggleVisitQuickBox(refs.visitQuickCustomerBox, refs.visitQuickCustomerToggle, "Không thấy khách? Thêm nhanh", "Thu gọn tạo nhanh khách");
      if (!refs.visitQuickCustomerBox.classList.contains("hidden")) {
        refs.visitQuickCustomerName.focus();
      }
    });
    refs.visitQuickProductToggle.addEventListener("click", function () {
      toggleVisitQuickBox(refs.visitQuickProductBox, refs.visitQuickProductToggle, "Không thấy dịch vụ? Thêm nhanh", "Thu gọn tạo nhanh dịch vụ");
      if (!refs.visitQuickProductBox.classList.contains("hidden")) {
        refs.visitQuickProductName.focus();
      }
    });
    refs.visitMonth.addEventListener("change", renderVisits);
    refs.referralMonth.addEventListener("change", renderReferrals);
    refs.pointsMonth.addEventListener("change", reloadBootstrap);
    refs.pointSaveBtn.addEventListener("click", savePoint);
    refs.customerTable.addEventListener("click", handleCustomerTableClick);
    refs.productTable.addEventListener("click", handleProductTableClick);
    refs.visitTable.addEventListener("click", handleVisitTableClick);
    refs.usersTable.addEventListener("click", handleUsersTableClick);
    if (refs.otpAddParamBtn) {
      refs.otpAddParamBtn.addEventListener("click", function () {
        var existing = collectOtpParamPairs();
        existing.push({ key: "", value: "" });
        renderOtpParamRows(existing);
      });
    }
    if (refs.otpSaveBtn) {
      refs.otpSaveBtn.addEventListener("click", saveOtpSettings);
    }
    if (refs.otpParamList) {
      refs.otpParamList.addEventListener("click", function (event) {
        var button = event.target.closest("button[data-action='remove-otp-param']");
        if (!button) return;
        var row = button.closest(".otp-param-row");
        if (row) {
          row.remove();
        }
      });
    }
    quickReasonButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var reason = button.getAttribute("data-reason") || "";
        refs.pointReason.value = refs.pointReason.value ? (refs.pointReason.value + "; " + reason) : reason;
        refs.pointReason.focus();
      });
    });
  }

  function login() {
    api("/api/auth.ashx", {
      action: "login",
      identity: refs.loginIdentity.value,
      password: refs.loginPassword.value
    }).then(function () {
      refs.loginIdentity.value = "";
      refs.loginPassword.value = "";
      setAuthMessage("");
      reloadBootstrap();
    }).catch(function (error) {
      setAuthMessage(error.message);
    });
  }

  function requestRegisterOtp() {
    api("/api/auth.ashx", {
      action: "request_register_otp",
      phone: refs.registerPhone.value
    }).then(function (payload) {
      setAuthMessage(payload.debugCode ? ("OTP local: " + payload.debugCode) : payload.message);
    }).catch(function (error) {
      setAuthMessage(error.message);
    });
  }

  function register() {
    api("/api/auth.ashx", {
      action: "register",
      displayName: refs.registerName.value,
      phone: refs.registerPhone.value,
      otpCode: refs.registerOtp.value,
      password: refs.registerPassword.value
    }).then(function () {
      refs.registerName.value = "";
      refs.registerPhone.value = "";
      refs.registerOtp.value = "";
      refs.registerPassword.value = "";
      reloadBootstrap();
    }).catch(function (error) {
      setAuthMessage(error.message);
    });
  }

  function requestResetOtp() {
    api("/api/auth.ashx", {
      action: "request_reset_otp",
      phone: refs.resetPhone.value
    }).then(function (payload) {
      setAuthMessage(payload.debugCode ? ("OTP local: " + payload.debugCode) : payload.message);
    }).catch(function (error) {
      setAuthMessage(error.message);
    });
  }

  function resetPassword() {
    api("/api/auth.ashx", {
      action: "reset_password",
      phone: refs.resetPhone.value,
      otpCode: refs.resetOtp.value,
      password: refs.resetPassword.value
    }).then(function (payload) {
      refs.resetOtp.value = "";
      refs.resetPassword.value = "";
      setAuthMessage(payload.message || "Đã đặt lại mật khẩu.");
    }).catch(function (error) {
      setAuthMessage(error.message);
    });
  }

  function logout() {
    api("/api/auth.ashx", { action: "logout" }).finally(function () {
      state.currentUser = null;
      state.otpSettings = null;
      state.otpSettingsLoaded = false;
      renderAuthState();
    });
  }

  function reloadBootstrap() {
    getJson("/api/bootstrap.ashx?month=" + encodeURIComponent(refs.pointsMonth.value || state.month)).then(function (payload) {
      state.currentUser = payload.currentUser;
      state.month = payload.month;
      state.customers = payload.customers || [];
      state.products = payload.products || [];
      state.visits = payload.visits || [];
      state.referrals = payload.referrals || [];
      state.users = payload.users || [];
      state.publicPoints = payload.publicPoints || [];
      state.myPoints = payload.myPoints || [];
      state.otpSettingsLoaded = false;
      renderAuthState();
    }).catch(function () {
      state.currentUser = null;
      state.otpSettings = null;
      state.otpSettingsLoaded = false;
      renderAuthState();
    });
  }

  function renderAuthState() {
    var loggedIn = !!state.currentUser;
    refs.authView.classList.toggle("hidden", loggedIn);
    refs.appView.classList.toggle("hidden", !loggedIn);
    if (!loggedIn) {
      return;
    }

    refs.sessionUser.textContent = state.currentUser.DisplayName + " | " + formatRole(state.currentUser.RoleKey);
    state.activePanel = readActivePanel();
    if (state.activePanel === "dashboard-panel") {
      state.activePanel = state.currentUser.RoleKey === "member" ? "points-panel" : "visits-panel";
    }
    refs.visitMonth.value = refs.visitMonth.value || state.month;
    refs.referralMonth.value = refs.referralMonth.value || state.month;
    refs.pointsMonth.value = refs.pointsMonth.value || state.month;
    refs.visitDate.value = refs.visitDate.value || formatDate(new Date().toISOString());
    refs.visitSaveBtn.textContent = refs.visitId.value ? "Cập nhật giao dịch" : "Lưu giao dịch";
    renderNav();
    renderQuickLaunch();
    renderDashboard();
    renderCustomers();
    renderProducts();
    renderVisitSelectors();
    renderVisits();
    renderReferrals();
    renderPoints();
    renderUsers();
    if (state.currentUser.RoleKey === "admin") {
      loadOtpSettings(false);
    }
  }

  function switchPanel(panelId, shouldPersist) {
    if (!state.navItems || !state.navItems.length) {
      return;
    }
    if (!state.navItems.some(function (item) { return item.id === panelId; })) {
      panelId = state.navItems[0].id;
    }

    state.activePanel = panelId;
    if (shouldPersist) {
      persistActivePanel(panelId);
    }

    refs.nav.querySelectorAll(".nav-btn").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-panel") === panelId);
    });

    state.navItems.forEach(function (item) {
      document.getElementById(item.id).classList.toggle("hidden", item.id !== panelId);
    });
    if (panelId === "otp-settings-panel" && state.currentUser && state.currentUser.RoleKey === "admin") {
      loadOtpSettings(false);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderQuickLaunch() {
    var role = state.currentUser.RoleKey;
    var canManage = role === "admin" || role === "operator";
    refs.quickLaunch.classList.toggle("hidden", false);
    refs.quickGoVisit.classList.toggle("hidden", !canManage);
    refs.quickGoCustomer.classList.toggle("hidden", !canManage);
    refs.quickGoPoint.classList.toggle("hidden", false);
    refs.quickGoPoint.textContent = role === "member" ? "Điểm của tôi" : "+ Cộng điểm";
  }

  function toggleVisitQuickBox(box, button, collapsedLabel, expandedLabel) {
    var isHidden = box.classList.contains("hidden");
    box.classList.toggle("hidden", !isHidden);
    button.textContent = isHidden ? expandedLabel : collapsedLabel;
  }

  function renderNav() {
    var role = state.currentUser.RoleKey;
    var items = [
      { id: "dashboard-panel", label: "Tổng quan", roles: ["admin", "operator", "member"] },
      { id: "customers-panel", label: "Khách hàng", roles: ["admin", "operator"] },
      { id: "products-panel", label: "Dịch vụ", roles: ["admin", "operator"] },
      { id: "visits-panel", label: "Giao dịch", roles: ["admin", "operator"] },
      { id: "referrals-panel", label: "Hoa hồng", roles: ["admin", "operator", "member"] },
      { id: "points-panel", label: "Điểm", roles: ["admin", "operator", "member"] },
      { id: "users-panel", label: "Tài khoản", roles: ["admin"] },
      { id: "otp-settings-panel", label: "OTP", roles: ["admin"] }
    ].filter(function (item) {
      return item.roles.indexOf(role) >= 0;
    });
    state.navItems = items;

    if (!items.some(function (item) { return item.id === state.activePanel; })) {
      state.activePanel = items[0].id;
    }

    refs.nav.innerHTML = items.map(function (item, index) {
      var isActive = item.id === state.activePanel;
      return "<button type=\"button\" class=\"nav-btn " + (isActive ? "active" : "") + "\" data-panel=\"" + item.id + "\">" + item.label + "</button>";
    }).join("");

    switchPanel(state.activePanel, false);
    refs.nav.querySelectorAll(".nav-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        switchPanel(button.getAttribute("data-panel"), true);
      });
    });
  }

  function renderDashboard() {
    var month = refs.pointsMonth.value || state.month;
    var visitMonthRows = state.visits.filter(function (row) { return String(row.VisitDate || "").slice(0, 7) === month; });
    var referralMonthRows = state.referrals.filter(function (row) { return String(row.VisitDate || "").slice(0, 7) === month; });
    var myPointsTotal = state.myPoints.reduce(function (sum, row) { return sum + Number(row.Points || 0); }, 0);
    refs.dashboardCards.innerHTML =
      "<div class=\"metric-card\"><span class=\"tag\">Khách hàng</span><strong>" + state.customers.length + "</strong></div>" +
      "<div class=\"metric-card\"><span class=\"tag\">Sản phẩm</span><strong>" + state.products.length + "</strong></div>" +
      "<div class=\"metric-card\"><span class=\"tag\">Lượt đến tháng này</span><strong>" + visitMonthRows.length + "</strong></div>" +
      "<div class=\"metric-card\"><span class=\"tag\">Hoa hồng tháng này</span><strong>" + formatMoney(referralMonthRows.reduce(function (sum, row) { return sum + Number(row.CommissionAmount || 0); }, 0)) + "</strong></div>" +
      "<div class=\"metric-card\"><span class=\"tag\">Điểm của tôi</span><strong>" + myPointsTotal + "</strong></div>";
  }

  function resetCustomerForm() {
    refs.customerId.value = "";
    refs.customerName.value = "";
    refs.customerPhone.value = "";
    refs.customerEmail.value = "";
    refs.customerNote.value = "";
    refs.customerMessage.textContent = "";
  }

  function saveCustomer() {
    api("/api/customers.ashx", {
      action: "save",
      customerId: refs.customerId.value,
      name: refs.customerName.value,
      phone: refs.customerPhone.value,
      email: refs.customerEmail.value,
      note: refs.customerNote.value
    }).then(function (payload) {
      refs.customerMessage.textContent = payload.message;
      resetCustomerForm();
      reloadBootstrap();
    }).catch(function (error) {
      refs.customerMessage.textContent = error.message;
    });
  }

  function handleCustomerTableClick(event) {
    var button = event.target.closest("button");
    if (!button) return;
    var id = button.getAttribute("data-id");
    var row = state.customers.find(function (item) { return item.CustomerId === id; });
    if (!row) return;
    if (button.getAttribute("data-action") === "edit") {
      refs.customerId.value = row.CustomerId;
      refs.customerName.value = row.Name || "";
      refs.customerPhone.value = row.Phone || "";
      refs.customerEmail.value = row.Email || "";
      refs.customerNote.value = row.Note || "";
      return;
    }
    if (button.getAttribute("data-action") === "delete" && confirm("Xóa khách hàng này?")) {
      api("/api/customers.ashx", { action: "delete", customerId: id }).then(reloadBootstrap);
    }
  }

  function renderCustomers() {
    var query = (refs.customerSearch.value || "").toLowerCase();
    var rows = state.customers.filter(function (item) {
      var haystack = [item.Name, item.Phone, item.Email, item.Note].join(" ").toLowerCase();
      return haystack.indexOf(query) >= 0;
    });
    refs.customerTable.innerHTML = rows.map(function (item) {
      return "<tr>" +
        cell("Tên", escapeHtml(item.Name)) +
        cell("Số điện thoại", escapeHtml(item.Phone)) +
        cell("Email", escapeHtml(item.Email)) +
        cell("Ghi chú", escapeHtml(item.Note)) +
        cell("Thao tác", actionGroup([
          "<button type=\"button\" class=\"secondary-btn\" data-action=\"edit\" data-id=\"" + item.CustomerId + "\">Sửa</button>",
          "<button type=\"button\" class=\"secondary-btn danger-btn\" data-action=\"delete\" data-id=\"" + item.CustomerId + "\">Xóa</button>"
        ]), "actions-cell") +
        "</tr>";
    }).join("") || emptyRow(5, "Chưa có dữ liệu.");
  }

  function resetProductForm() {
    refs.productId.value = "";
    refs.productName.value = "";
    refs.productCode.value = "";
    refs.productPrice.value = "";
    refs.productNote.value = "";
    refs.productMessage.textContent = "";
  }

  function saveProduct() {
    api("/api/products.ashx", {
      action: "save",
      productId: refs.productId.value,
      name: refs.productName.value,
      code: refs.productCode.value,
      defaultPrice: refs.productPrice.value,
      note: refs.productNote.value
    }).then(function (payload) {
      refs.productMessage.textContent = payload.message;
      resetProductForm();
      reloadBootstrap();
    }).catch(function (error) {
      refs.productMessage.textContent = error.message;
    });
  }

  function handleProductTableClick(event) {
    var button = event.target.closest("button");
    if (!button) return;
    var id = button.getAttribute("data-id");
    var row = state.products.find(function (item) { return item.ProductId === id; });
    if (!row) return;
    if (button.getAttribute("data-action") === "edit") {
      refs.productId.value = row.ProductId;
      refs.productName.value = row.Name || "";
      refs.productCode.value = row.Code || "";
      refs.productPrice.value = row.DefaultPrice || "";
      refs.productNote.value = row.Note || "";
      return;
    }
    if (button.getAttribute("data-action") === "delete" && confirm("Xóa sản phẩm này?")) {
      api("/api/products.ashx", { action: "delete", productId: id }).then(reloadBootstrap);
    }
  }

  function renderProducts() {
    refs.productTable.innerHTML = state.products.map(function (item) {
      return "<tr>" +
        cell("Tên", escapeHtml(item.Name)) +
        cell("Mã", escapeHtml(item.Code)) +
        cell("Giá", formatMoney(item.DefaultPrice)) +
        cell("Ghi chú", escapeHtml(item.Note)) +
        cell("Thao tác", actionGroup([
          "<button type=\"button\" class=\"secondary-btn\" data-action=\"edit\" data-id=\"" + item.ProductId + "\">Sửa</button>",
          "<button type=\"button\" class=\"secondary-btn danger-btn\" data-action=\"delete\" data-id=\"" + item.ProductId + "\">Xóa</button>"
        ]), "actions-cell") +
        "</tr>";
    }).join("") || emptyRow(5, "Chưa có dữ liệu.");
  }

  function renderVisitSelectors() {
    var selectedCustomer = refs.visitCustomer.value;
    var selectedProduct = refs.visitProduct.value;
    var selectedReferrer = refs.visitReferrer.value;
    var selectedPointMember = refs.pointMember.value;
    var presets = readLastVisitPreset();
    var customerOptions = "<option value=\"\">Chọn khách hàng</option>" + state.customers.map(function (item) {
      return "<option value=\"" + item.CustomerId + "\">" + escapeHtml(item.Name) + "</option>";
    }).join("");
    var productOptions = "<option value=\"\">Chọn sản phẩm</option>" + state.products.map(function (item) {
      return "<option value=\"" + item.ProductId + "\">" + escapeHtml(item.Name) + "</option>";
    }).join("");
    var memberOptions = "<option value=\"\">Không có người giới thiệu</option>" + state.users.filter(function (item) {
      return item.RoleKey === "member" || item.RoleKey === "operator";
    }).map(function (item) {
      return "<option value=\"" + item.UserId + "\">" + escapeHtml(item.DisplayName) + "</option>";
    }).join("");

    refs.visitCustomer.innerHTML = customerOptions;
    refs.visitProduct.innerHTML = productOptions;
    refs.visitReferrer.innerHTML = memberOptions;
    refs.pointMember.innerHTML = "<option value=\"\">Chọn thành viên</option>" + state.users.filter(function (item) {
      return item.RoleKey !== "admin";
    }).map(function (item) {
      return "<option value=\"" + item.UserId + "\">" + escapeHtml(item.DisplayName) + "</option>";
    }).join("");
    refs.visitCustomer.value = selectedCustomer || presets.customerId;
    refs.visitProduct.value = selectedProduct || presets.productId;
    refs.visitReferrer.value = selectedReferrer || presets.referrerUserId;
    refs.pointMember.value = selectedPointMember;
    if ((refs.pointMember.value || "") === "" && state.currentUser.RoleKey === "member") {
      refs.pointMember.value = state.currentUser.UserId || "";
    }
  }

  function handleVisitProductChanged() {
    var currentRevenue = Number(refs.visitRevenue.value || 0);
    if (currentRevenue > 0) {
      return;
    }
    var selectedProduct = state.products.find(function (item) { return item.ProductId === refs.visitProduct.value; });
    if (selectedProduct && Number(selectedProduct.DefaultPrice || 0) > 0) {
      refs.visitRevenue.value = Number(selectedProduct.DefaultPrice || 0);
    }
  }

  function ensureQuickCustomerIfNeeded() {
    if (refs.visitCustomer.value) {
      return Promise.resolve(refs.visitCustomer.value);
    }
    var quickName = (refs.visitQuickCustomerName.value || "").trim();
    if (!quickName) {
      return Promise.resolve("");
    }
    return api("/api/customers.ashx", {
      action: "save",
      name: quickName,
      phone: refs.visitQuickCustomerPhone.value,
      email: "",
      note: "Tạo nhanh từ màn giao dịch"
    }).then(function (payload) {
      var id = payload.customerId || "";
      refs.visitCustomer.value = id;
      return id;
    });
  }

  function ensureQuickProductIfNeeded() {
    if (refs.visitProduct.value) {
      return Promise.resolve(refs.visitProduct.value);
    }
    var quickName = (refs.visitQuickProductName.value || "").trim();
    if (!quickName) {
      return Promise.resolve("");
    }
    var defaultPrice = Number(refs.visitQuickProductPrice.value || 0);
    return api("/api/products.ashx", {
      action: "save",
      name: quickName,
      code: "",
      defaultPrice: defaultPrice,
      note: "Tạo nhanh từ màn giao dịch"
    }).then(function (payload) {
      var id = payload.productId || "";
      refs.visitProduct.value = id;
      if (defaultPrice > 0 && Number(refs.visitRevenue.value || 0) <= 0) {
        refs.visitRevenue.value = defaultPrice;
      }
      return id;
    });
  }

  function saveVisit() {
    var resolvedCustomerId = "";
    var resolvedProductId = "";
    ensureQuickCustomerIfNeeded().then(function (customerId) {
      resolvedCustomerId = customerId || refs.visitCustomer.value;
      if (!resolvedCustomerId) {
        throw new Error("Vui lòng chọn khách hàng hoặc tạo nhanh khách mới.");
      }
      return ensureQuickProductIfNeeded();
    }).then(function (productId) {
      resolvedProductId = productId || refs.visitProduct.value;
      if (!resolvedProductId) {
        throw new Error("Vui lòng chọn dịch vụ hoặc tạo nhanh dịch vụ mới.");
      }
      return api("/api/visits.ashx", {
        action: "save",
        visitId: refs.visitId.value,
        customerId: resolvedCustomerId,
        productId: resolvedProductId,
        referrerUserId: refs.visitReferrer.value,
        visitDate: refs.visitDate.value,
        revenue: refs.visitRevenue.value,
        note: refs.visitNote.value
      });
    }).then(function (payload) {
      refs.visitMessage.textContent = payload.message;
      persistLastVisitPreset(resolvedCustomerId, resolvedProductId, refs.visitReferrer.value);
      resetVisitForm();
      reloadBootstrap();
    }).catch(function (error) {
      refs.visitMessage.textContent = error.message;
    });
  }

  function resetVisitForm() {
    refs.visitId.value = "";
    refs.visitCustomer.value = "";
    refs.visitProduct.value = "";
    refs.visitReferrer.value = "";
    refs.visitRevenue.value = "";
    refs.visitNote.value = "";
    refs.visitSearch.value = "";
    refs.visitQuickCustomerName.value = "";
    refs.visitQuickCustomerPhone.value = "";
    refs.visitQuickProductName.value = "";
    refs.visitQuickProductPrice.value = "";
    refs.visitQuickCustomerBox.classList.add("hidden");
    refs.visitQuickProductBox.classList.add("hidden");
    refs.visitQuickCustomerToggle.textContent = "Không thấy khách? Thêm nhanh";
    refs.visitQuickProductToggle.textContent = "Không thấy dịch vụ? Thêm nhanh";
    refs.visitDate.value = formatDate(new Date().toISOString());
    refs.visitMessage.textContent = "";
    refs.visitSaveBtn.textContent = "Lưu giao dịch";
  }

  function handleVisitTableClick(event) {
    var button = event.target.closest("button");
    if (!button) return;
    var action = button.getAttribute("data-action");
    var id = button.getAttribute("data-id");
    var row = state.visits.find(function (item) { return item.VisitId === id; });
    if (!row) return;

    if (action === "edit") {
      refs.visitQuickCustomerBox.classList.add("hidden");
      refs.visitQuickProductBox.classList.add("hidden");
      refs.visitQuickCustomerToggle.textContent = "Không thấy khách? Thêm nhanh";
      refs.visitQuickProductToggle.textContent = "Không thấy dịch vụ? Thêm nhanh";
      refs.visitId.value = row.VisitId || "";
      refs.visitCustomer.value = row.CustomerId || "";
      refs.visitProduct.value = row.ProductId || "";
      refs.visitReferrer.value = row.ReferrerUserId || "";
      refs.visitDate.value = formatDate(row.VisitDate) || formatDate(new Date().toISOString());
      refs.visitRevenue.value = row.Revenue || "";
      refs.visitNote.value = row.Note || "";
      refs.visitMessage.textContent = "Đang sửa giao dịch đã chọn.";
      refs.visitSaveBtn.textContent = "Cập nhật giao dịch";
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action === "delete" && confirm("Xóa giao dịch này?")) {
      api("/api/visits.ashx", { action: "delete", visitId: button.getAttribute("data-id") }).then(reloadBootstrap);
    }
  }

  function renderVisits() {
    var month = refs.visitMonth.value || state.month;
    var query = (refs.visitSearch.value || "").toLowerCase();
    var rows = state.visits.filter(function (item) {
      if (String(item.VisitDate || "").slice(0, 7) !== month) {
        return false;
      }
      if (!query) {
        return true;
      }
      var haystack = [item.CustomerName, item.ProductName, item.ReferrerName, item.Note].join(" ").toLowerCase();
      return haystack.indexOf(query) >= 0;
    });
    refs.visitTable.innerHTML = rows.map(function (item) {
      return "<tr>" +
        cell("Ngày", formatDate(item.VisitDate)) +
        cell("Khách", escapeHtml(item.CustomerName)) +
        cell("Dịch vụ", escapeHtml(item.ProductName)) +
        cell("Lần", String(item.OccurrenceInMonth || "")) +
        cell("Voucher", formatMoney(item.VoucherAmount) + " <span class=\"tag\">" + Math.round(Number(item.VoucherRate || 0) * 100) + "%</span>") +
        cell("Người giới thiệu", escapeHtml(item.ReferrerName)) +
        cell("Thao tác", actionGroup([
          "<button type=\"button\" class=\"secondary-btn\" data-action=\"edit\" data-id=\"" + item.VisitId + "\">Sửa</button>",
          "<button type=\"button\" class=\"secondary-btn danger-btn\" data-action=\"delete\" data-id=\"" + item.VisitId + "\">Xóa</button>"
        ]), "actions-cell") +
        "</tr>";
    }).join("") || emptyRow(7, "Chưa có giao dịch trong tháng này.");
  }

  function renderReferrals() {
    var month = refs.referralMonth.value || state.month;
    var rows = state.referrals.filter(function (item) {
      return String(item.VisitDate || "").slice(0, 7) === month;
    });
    refs.referralTable.innerHTML = rows.map(function (item) {
      return "<tr>" +
        cell("Ngày", formatDate(item.VisitDate)) +
        cell("Người giới thiệu", escapeHtml(item.ReferrerName)) +
        cell("Khách", escapeHtml(item.CustomerName)) +
        cell("Lần", String(item.OccurrenceInMonth || "")) +
        cell("Tỷ lệ", Math.round(Number(item.CommissionRate || 0) * 100) + "%") +
        cell("Hoa hồng", formatMoney(item.CommissionAmount)) +
        "</tr>";
    }).join("") || emptyRow(6, "Chưa có hoa hồng trong tháng này.");
  }

  function savePoint() {
    api("/api/points.ashx", {
      action: "save",
      memberUserId: refs.pointMember.value,
      points: refs.pointValue.value,
      reasonDetail: refs.pointReason.value,
      isPublic: refs.pointPublic.checked
    }).then(function (payload) {
      refs.pointMessage.textContent = payload.message;
      refs.pointMember.value = "";
      refs.pointValue.value = "";
      refs.pointReason.value = "";
      refs.pointPublic.checked = true;
      reloadBootstrap();
    }).catch(function (error) {
      refs.pointMessage.textContent = error.message;
    });
  }

  function renderPoints() {
    var canAward = state.currentUser.RoleKey === "admin" || state.currentUser.RoleKey === "operator";
    refs.pointsFormCard.classList.toggle("hidden", !canAward);

    refs.publicPointsTable.innerHTML = state.publicPoints.map(function (item) {
      return "<tr>" +
        cell("Ngày", formatDate(item.AwardedAt)) +
        cell("Thành viên", escapeHtml(item.MemberName)) +
        cell("Điểm", String(item.Points || 0)) +
        cell("Lý do", escapeHtml(item.ReasonDetail)) +
        cell("Người ghi", escapeHtml(item.AwardedByName)) +
        "</tr>";
    }).join("") || emptyRow(5, "Chưa có điểm công khai trong tháng này.");

    refs.myPointsTable.innerHTML = state.myPoints.map(function (item) {
      return "<tr>" +
        cell("Ngày", formatDate(item.AwardedAt)) +
        cell("Điểm", String(item.Points || 0)) +
        cell("Lý do", escapeHtml(item.ReasonDetail)) +
        cell("Người ghi", escapeHtml(item.AwardedByName)) +
        "</tr>";
    }).join("") || emptyRow(4, "Chưa có điểm của bạn trong tháng này.");

    var total = state.myPoints.reduce(function (sum, item) {
      return sum + Number(item.Points || 0);
    }, 0);
    refs.myPointsSummary.textContent = "Tổng điểm tháng này: " + total;
  }

  function handleUsersTableClick(event) {
    var button = event.target.closest("button");
    if (!button) return;
    var userId = button.getAttribute("data-id");
    var row = state.users.find(function (item) { return item.UserId === userId; });
    if (!row) return;
    var nextRole = button.getAttribute("data-role");
    var nextStatus = button.getAttribute("data-status") === "true";
    api("/api/users.ashx", {
      action: "update",
      userId: userId,
      roleKey: nextRole || row.RoleKey,
      isActive: nextStatus
    }).then(reloadBootstrap);
  }

  function renderUsers() {
    if (!refs.usersTable) return;
    refs.usersTable.innerHTML = state.users.map(function (item) {
      var activateLabel = item.IsActive ? "Khóa" : "Mở khóa";
      var nextStatus = item.IsActive ? "false" : "true";
      return "<tr>" +
        cell("Họ tên", escapeHtml(item.DisplayName)) +
        cell("Tài khoản", escapeHtml(item.Username)) +
        cell("Số điện thoại", escapeHtml(item.Phone)) +
        cell("Vai trò", actionGroup([
          "<button type=\"button\" class=\"secondary-btn\" data-id=\"" + item.UserId + "\" data-role=\"member\" data-status=\"" + item.IsActive + "\">Thành viên</button>",
          "<button type=\"button\" class=\"secondary-btn\" data-id=\"" + item.UserId + "\" data-role=\"operator\" data-status=\"" + item.IsActive + "\">Điều hành</button>",
          "<button type=\"button\" class=\"secondary-btn\" data-id=\"" + item.UserId + "\" data-role=\"admin\" data-status=\"" + item.IsActive + "\">Quản trị</button>"
        ]), "actions-cell") +
        cell("Trạng thái", item.IsActive ? "Đang hoạt động" : "Đã khóa") +
        cell("Kiểm soát", actionGroup([
          "<button type=\"button\" class=\"secondary-btn danger-btn\" data-id=\"" + item.UserId + "\" data-role=\"" + item.RoleKey + "\" data-status=\"" + nextStatus + "\">" + activateLabel + "</button>"
        ]), "actions-cell") +
        "</tr>";
    }).join("") || emptyRow(6, "Không có tài khoản.");
  }

  bindEvents();
  reloadBootstrap();
})();
