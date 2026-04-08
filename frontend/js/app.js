(function () {
  "use strict";

  var state = {
    user: null,
    activeSection: "overview",
    lastAppSection: "overview",
    activeSettingsSection: "profile",
    isSettingsMode: false,
    filters: {
      keyword: "",
      categoryId: "",
      type: "",
      minAmount: "",
      maxAmount: "",
      fromDate: "",
      toDate: "",
      tag: ""
    }
  };

  var dom = {};
  var AUTO_CATEGORY_VALUE = "auto_detect";
  var BACKEND_API_BASE = String(
    window.NEXSPEND_API_BASE ||
    (
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:4000/api"
        : window.location.origin + "/api"
    )
  ).replace(/\/+$/, "");
  var RUNTIME_API_BASE = BACKEND_API_BASE;
  var protectedPromptState = null;
  var inactivityLockTimerId = null;
  var inactivityLockDueAtMs = 0;
  var autoLockCountdownIntervalId = null;
  var pinUnlockStatusTimerId = null;

  var categoryKeywords = {
    expense: {
      Food: ["food", "restaurant", "swiggy", "zomato", "grocery", "coffee", "snack", "lunch", "dinner"],
      Rent: ["rent", "landlord", "lease"],
      Travel: ["uber", "ola", "metro", "bus", "train", "flight", "fuel", "petrol", "diesel"],
      Bills: ["electricity", "wifi", "internet", "water", "bill", "phone", "gas"],
      Shopping: ["amazon", "flipkart", "mall", "shopping", "clothes", "fashion"],
      Health: ["medicine", "doctor", "hospital", "clinic", "pharmacy", "health"],
      Subscriptions: ["netflix", "spotify", "subscription", "prime", "apple", "youtube"]
    },
    income: {
      Salary: ["salary", "payroll", "payout", "wage"],
      Freelance: ["freelance", "client", "project", "gig", "invoice"],
      Investment: ["dividend", "interest", "mutual fund", "stock", "investment"]
    }
  };
  var MONTH_INDEX_BY_NAME = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheDom();
    bindStaticEvents();
    setDefaultDates();
    syncViewFromSession();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheDom() {
    dom.authView = byId("authView");
    dom.pinUnlockView = byId("pinUnlockView");
    dom.appView = byId("appView");
    dom.sectionNav = byId("sectionNav");
    dom.quickAddFab = byId("quickAddFab");
    dom.sidebarUser = byId("sidebarUser");
    dom.editProfileBtn = byId("editProfileBtn");
    dom.userAvatar = byId("userAvatar");
    dom.userNameBadge = byId("userNameBadge");
    dom.userBadge = byId("userBadge");
    dom.themeToggle = byId("themeToggle");
    dom.logoutBtn = byId("logoutBtn");
    dom.lockBtn = byId("lockBtn");

    dom.loginTabBtn = byId("loginTabBtn");
    dom.signupTabBtn = byId("signupTabBtn");
    dom.loginForm = byId("loginForm");
    dom.signupForm = byId("signupForm");
    dom.loginEmail = byId("loginEmail");
    dom.loginPassword = byId("loginPassword");
    dom.forgotPasswordBtn = byId("forgotPasswordBtn");
    dom.signupEmail = byId("signupEmail");
    dom.signupPassword = byId("signupPassword");
    dom.signupPin = byId("signupPin");
    dom.authMessage = byId("authMessage");

    dom.pinUnlockForm = byId("pinUnlockForm");
    dom.unlockPin = byId("unlockPin");
    dom.unlockPinBtn = byId("unlockPinBtn");
    dom.pinMessage = byId("pinMessage");
    dom.pinLockHint = byId("pinLockHint");

    dom.totalBalance = byId("totalBalance");
    dom.netWorth = byId("netWorth");
    dom.monthlyIncome = byId("monthlyIncome");
    dom.monthlyExpense = byId("monthlyExpense");
    dom.todaySpend = byId("todaySpend");
    dom.weekSpend = byId("weekSpend");
    dom.monthSpend = byId("monthSpend");
    dom.savingsRate = byId("savingsRate");

    dom.transactionForm = byId("transactionForm");
    dom.transactionId = byId("transactionId");
    dom.transactionType = byId("transactionType");
    dom.transactionAmount = byId("transactionAmount");
    dom.transactionDate = byId("transactionDate");
    dom.transactionCategory = byId("transactionCategory");
    dom.transactionTags = byId("transactionTags");
    dom.transactionAccount = byId("transactionAccount");
    dom.transactionNotes = byId("transactionNotes");
    dom.transactionDetectInput = byId("transactionDetectInput");
    dom.detectTransactionBtn = byId("detectTransactionBtn");
    dom.transactionDetectMessage = byId("transactionDetectMessage");
    dom.isRecurringTransaction = byId("isRecurringTransaction");
    dom.recurringFrequency = byId("recurringFrequency");
    dom.cancelEditBtn = byId("cancelEditBtn");
    dom.editIndicator = byId("editIndicator");

    dom.filtersForm = byId("filtersForm");
    dom.filterKeyword = byId("filterKeyword");
    dom.filterCategory = byId("filterCategory");
    dom.filterType = byId("filterType");
    dom.filterMinAmount = byId("filterMinAmount");
    dom.filterMaxAmount = byId("filterMaxAmount");
    dom.filterFromDate = byId("filterFromDate");
    dom.filterToDate = byId("filterToDate");
    dom.filterTag = byId("filterTag");
    dom.clearFiltersBtn = byId("clearFiltersBtn");

    dom.transactionsBody = byId("transactionsBody");
    dom.transactionCount = byId("transactionCount");
    dom.openTransactionsModalBtn = byId("openTransactionsModalBtn");
    dom.allTransactionsModal = byId("allTransactionsModal");
    dom.transactionsModalCount = byId("transactionsModalCount");
    dom.transactionRecordModal = byId("transactionRecordModal");
    dom.transactionRecordMeta = byId("transactionRecordMeta");
    dom.transactionRecordBody = byId("transactionRecordBody");
    dom.transactionRecordEditBtn = byId("transactionRecordEditBtn");
    dom.transactionRecordDeleteBtn = byId("transactionRecordDeleteBtn");

    dom.categoryForm = byId("categoryForm");
    dom.newCategoryName = byId("newCategoryName");
    dom.newCategoryType = byId("newCategoryType");
    dom.categoriesList = byId("categoriesList");

    dom.accountForm = byId("accountForm");
    dom.newAccountName = byId("newAccountName");
    dom.newAccountType = byId("newAccountType");
    dom.newAccountInitialBalance = byId("newAccountInitialBalance");
    dom.accountsList = byId("accountsList");
    dom.defaultCurrency = byId("defaultCurrency");

    dom.budgetForm = byId("budgetForm");
    dom.budgetCategory = byId("budgetCategory");
    dom.budgetLimit = byId("budgetLimit");
    dom.budgetsList = byId("budgetsList");

    dom.goalForm = byId("goalForm");
    dom.goalName = byId("goalName");
    dom.goalTarget = byId("goalTarget");
    dom.goalDeadline = byId("goalDeadline");
    dom.goalsList = byId("goalsList");

    dom.reminderForm = byId("reminderForm");
    dom.reminderTitle = byId("reminderTitle");
    dom.reminderAmount = byId("reminderAmount");
    dom.reminderDate = byId("reminderDate");
    dom.reminderFrequency = byId("reminderFrequency");
    dom.remindersList = byId("remindersList");

    dom.recurringList = byId("recurringList");
    dom.insightsList = byId("insightsList");

    dom.exportCsvBtn = byId("exportCsvBtn");
    dom.exportTransactionsPdfBtn = byId("exportTransactionsPdfBtn");
    dom.exportPdfBtn = byId("exportPdfBtn");
    dom.backupBtn = byId("backupBtn");
    dom.restoreInput = byId("restoreInput");
    dom.importTransactionsInput = byId("importTransactionsInput");
    dom.importPdfInput = byId("importPdfInput");
    dom.exportMessage = byId("exportMessage");
    dom.settingsPanel = byId("settingsWorkspace");
    dom.settingsSidebarNav = byId("settingsSidebarNav");
    dom.settingsNavButtons = Array.prototype.slice.call(document.querySelectorAll("#settingsSidebarNav [data-settings-nav]"));
    dom.settingsSectionPanels = Array.prototype.slice.call(document.querySelectorAll("[data-settings-panel]"));
    dom.profileForm = byId("profileForm");
    dom.profileNameInput = byId("profileNameInput");
    dom.profileEmailInput = byId("profileEmailInput");
    dom.profileFormMessage = byId("profileFormMessage");
    dom.changePasswordForm = byId("changePasswordForm");
    dom.currentPasswordInput = byId("currentPasswordInput");
    dom.newPasswordInput = byId("newPasswordInput");
    dom.confirmPasswordInput = byId("confirmPasswordInput");
    dom.settingsForgotPasswordBtn = byId("settingsForgotPasswordBtn");
    dom.changePasswordMessage = byId("changePasswordMessage");
    dom.changePinForm = byId("changePinForm");
    dom.newPinInput = byId("newPinInput");
    dom.confirmPinInput = byId("confirmPinInput");
    dom.changePinMessage = byId("changePinMessage");
    dom.autoLockForm = byId("autoLockForm");
    dom.autoLockEnabledInput = byId("autoLockEnabledInput");
    dom.autoLockMinutesInput = byId("autoLockMinutesInput");
    dom.autoLockCountdown = byId("autoLockCountdown");
    dom.lockNowBtn = byId("lockNowBtn");
    dom.autoLockMessage = byId("autoLockMessage");
    dom.forgotPasswordModal = byId("forgotPasswordModal");
    dom.forgotPasswordForm = byId("forgotPasswordForm");
    dom.forgotPasswordEmailInput = byId("forgotPasswordEmailInput");
    dom.requestResetCodeBtn = byId("requestResetCodeBtn");
    dom.forgotPasswordCodeHint = byId("forgotPasswordCodeHint");
    dom.forgotPasswordCodeInput = byId("forgotPasswordCodeInput");
    dom.forgotPasswordNewPasswordInput = byId("forgotPasswordNewPasswordInput");
    dom.forgotPasswordConfirmPasswordInput = byId("forgotPasswordConfirmPasswordInput");
    dom.forgotPasswordMessage = byId("forgotPasswordMessage");
    dom.protectedPromptModal = byId("protectedPromptModal");
    dom.protectedPromptForm = byId("protectedPromptForm");
    dom.protectedPromptTitle = byId("protectedPromptTitle");
    dom.protectedPromptMessage = byId("protectedPromptMessage");
    dom.protectedPromptLabel = byId("protectedPromptLabel");
    dom.protectedPromptInput = byId("protectedPromptInput");
    dom.protectedPromptError = byId("protectedPromptError");
    dom.protectedPromptOkBtn = byId("protectedPromptOkBtn");

    dom.sectionButtons = Array.prototype.slice.call(document.querySelectorAll("#sectionNav .section-nav-btn"));
    dom.appSections = Array.prototype.slice.call(document.querySelectorAll("[data-app-section]"));
  }

  function bindStaticEvents() {
    dom.loginTabBtn.addEventListener("click", function () {
      switchAuthTab("login");
    });
    dom.signupTabBtn.addEventListener("click", function () {
      switchAuthTab("signup");
    });
    dom.loginForm.addEventListener("submit", handleLogin);
    dom.signupForm.addEventListener("submit", handleSignup);
    dom.pinUnlockForm.addEventListener("submit", handlePinUnlock);
    if (dom.forgotPasswordBtn) {
      dom.forgotPasswordBtn.addEventListener("click", openForgotPasswordModal);
    }

    dom.themeToggle.addEventListener("click", toggleTheme);
    dom.logoutBtn.addEventListener("click", handleLogout);
    dom.lockBtn.addEventListener("click", handleLock);
    if (dom.editProfileBtn) {
      dom.editProfileBtn.addEventListener("click", function () {
        openSettingsPanel("profile");
      });
    }
    if (dom.settingsSidebarNav) {
      dom.settingsSidebarNav.addEventListener("click", handleSettingsSidebarNavClick);
    }
    if (dom.settingsPanel) {
      dom.settingsPanel.addEventListener("click", handleSettingsWorkspaceClick);
    }
    if (dom.sectionNav) {
      dom.sectionNav.addEventListener("click", handleSectionNavClick);
    }
    dom.quickAddFab.addEventListener("click", function () {
      setActiveSection("transactions");
      var panel = byId("quickAddPanel");
      if (panel) {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      dom.transactionAmount.focus();
    });

    dom.transactionType.addEventListener("change", function () {
      populateTransactionCategorySelect(dom.transactionType.value, "");
    });
    dom.transactionForm.addEventListener("submit", handleTransactionSubmit);
    dom.cancelEditBtn.addEventListener("click", resetTransactionForm);
    if (dom.detectTransactionBtn) {
      dom.detectTransactionBtn.addEventListener("click", handleDetectTransactionClick);
    }
    if (dom.transactionDetectInput) {
      dom.transactionDetectInput.addEventListener("input", function () {
        setTransactionDetectMessage("", "");
      });
    }

    dom.filtersForm.addEventListener("submit", handleFiltersSubmit);
    dom.clearFiltersBtn.addEventListener("click", clearFilters);

    dom.categoryForm.addEventListener("submit", handleAddCategory);
    dom.accountForm.addEventListener("submit", handleAddAccount);
    dom.defaultCurrency.addEventListener("change", handleCurrencyChange);

    dom.budgetForm.addEventListener("submit", handleBudgetSubmit);
    dom.goalForm.addEventListener("submit", handleGoalSubmit);
    dom.reminderForm.addEventListener("submit", handleReminderSubmit);

    if (dom.transactionsBody) {
      dom.transactionsBody.addEventListener("click", handleTransactionsTableClick);
    }
    if (dom.openTransactionsModalBtn) {
      dom.openTransactionsModalBtn.addEventListener("click", openAllTransactionsModal);
    }
    if (dom.allTransactionsModal) {
      dom.allTransactionsModal.addEventListener("click", handleAllTransactionsModalClick);
    }
    if (dom.transactionRecordModal) {
      dom.transactionRecordModal.addEventListener("click", handleTransactionRecordModalClick);
    }
    if (dom.profileForm) {
      dom.profileForm.addEventListener("submit", handleProfileFormSubmit);
    }
    if (dom.changePasswordForm) {
      dom.changePasswordForm.addEventListener("submit", handleChangePasswordFormSubmit);
    }
    if (dom.settingsForgotPasswordBtn) {
      dom.settingsForgotPasswordBtn.addEventListener("click", openForgotPasswordModal);
    }
    if (dom.changePinForm) {
      dom.changePinForm.addEventListener("submit", handleChangePinFormSubmit);
    }
    if (dom.autoLockForm) {
      dom.autoLockForm.addEventListener("submit", handleAutoLockFormSubmit);
    }
    if (dom.autoLockEnabledInput) {
      dom.autoLockEnabledInput.addEventListener("change", handleAutoLockToggleChange);
    }
    if (dom.lockNowBtn) {
      dom.lockNowBtn.addEventListener("click", handleLockNowClick);
    }
    if (dom.forgotPasswordModal) {
      dom.forgotPasswordModal.addEventListener("click", handleForgotPasswordModalClick);
    }
    if (dom.forgotPasswordForm) {
      dom.forgotPasswordForm.addEventListener("submit", handleForgotPasswordFormSubmit);
    }
    if (dom.requestResetCodeBtn) {
      dom.requestResetCodeBtn.addEventListener("click", handleRequestPasswordResetCode);
    }
    dom.categoriesList.addEventListener("click", handleCategoriesListClick);
    dom.accountsList.addEventListener("click", handleAccountsListClick);
    dom.budgetsList.addEventListener("click", handleBudgetsListClick);
    dom.goalsList.addEventListener("click", handleGoalsListClick);
    dom.remindersList.addEventListener("click", handleRemindersListClick);
    dom.recurringList.addEventListener("click", handleRecurringListClick);

    dom.exportCsvBtn.addEventListener("click", exportTransactionsCsv);
    if (dom.exportTransactionsPdfBtn) {
      dom.exportTransactionsPdfBtn.addEventListener("click", exportTransactionsPdf);
    }
    dom.exportPdfBtn.addEventListener("click", exportSummaryPdf);
    dom.backupBtn.addEventListener("click", backupUserData);
    dom.restoreInput.addEventListener("change", restoreUserDataFromFile);
    if (dom.importTransactionsInput) {
      dom.importTransactionsInput.addEventListener("change", importTransactionsFromCsvFile);
    }
    if (dom.importPdfInput) {
      dom.importPdfInput.addEventListener("change", importTransactionsFromPdfFile);
    }
    if (dom.protectedPromptForm) {
      dom.protectedPromptForm.addEventListener("submit", handleProtectedPromptSubmit);
    }
    if (dom.protectedPromptModal) {
      dom.protectedPromptModal.addEventListener("click", handleProtectedPromptModalClick);
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    document.addEventListener("pointerdown", handleAutoLockActivity);
    document.addEventListener("touchstart", handleAutoLockActivity, { passive: true });
    document.addEventListener("scroll", handleAutoLockActivity, { passive: true });
    document.addEventListener("keydown", handleAutoLockActivity);
  }

  function setDefaultDates() {
    var today = toDateInputValue(new Date());
    dom.transactionDate.value = today;
    dom.reminderDate.value = today;
  }

  function switchAuthTab(tabName) {
    var showLogin = tabName === "login";
    dom.loginForm.classList.toggle("hidden", !showLogin);
    dom.signupForm.classList.toggle("hidden", showLogin);
    dom.loginTabBtn.classList.toggle("active", showLogin);
    dom.signupTabBtn.classList.toggle("active", !showLogin);
    setAuthMessage("");
  }

  async function handleLogin(event) {
    event.preventDefault();
    try {
      await window.AuthService.login({
        email: dom.loginEmail.value,
        password: dom.loginPassword.value
      });
      dom.loginForm.reset();
      setAuthMessage("Login successful.", false);
      syncViewFromSession();
    } catch (error) {
      setAuthMessage(error.message, true);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    try {
      await window.AuthService.signup({
        email: dom.signupEmail.value,
        password: dom.signupPassword.value,
        pin: dom.signupPin.value
      });
      dom.signupForm.reset();
      setAuthMessage("Account created. You are now logged in.", false);
      syncViewFromSession();
    } catch (error) {
      setAuthMessage(error.message, true);
    }
  }

  function handlePinUnlock(event) {
    event.preventDefault();
    try {
      window.AuthService.unlockSession(dom.unlockPin.value);
      dom.pinUnlockForm.reset();
      dom.pinMessage.textContent = "";
      refreshPinUnlockStatusUi();
      activateApp();
    } catch (error) {
      dom.pinMessage.textContent = error.message;
      dom.pinMessage.style.color = "var(--danger)";
      refreshPinUnlockStatusUi();
    }
  }

  function handleLogout() {
    clearAutoLockInactivityTimer();
    window.AuthService.logout();
    state.user = null;
    syncViewFromSession();
  }

  function handleLock() {
    try {
      window.AuthService.lockSession();
      showView("pin");
      if (dom.pinMessage) {
        dom.pinMessage.textContent = "App locked. Enter PIN to continue.";
        dom.pinMessage.style.color = "var(--muted)";
      }
      refreshPinUnlockStatusUi();
    } catch (error) {
      setAppMessage(error.message, true);
    }
  }

  function handleLockNowClick() {
    handleLock();
  }

  function syncViewFromSession() {
    state.user = window.AuthService.getCurrentUser();
    if (!state.user) {
      showView("auth");
      switchAuthTab("login");
      return;
    }
    applyTheme((state.user.settings && state.user.settings.theme) || "light", false);
    if (window.AuthService.isLocked()) {
      showView("pin");
      return;
    }
    activateApp();
  }

  function activateApp() {
    state.user = window.AuthService.getCurrentUser();
    if (!state.user) {
      showView("auth");
      return;
    }
    processDueRecurringTransactions();
    state.user = window.AuthService.getCurrentUser();
    showView("app");
    populateDropdowns();
    setActiveSection(state.activeSection || "overview");
    renderAll();
    refreshCurrentUserFromBackendSilently();
    syncAutoLockTimerState();
  }

  function refreshCurrentUserFromBackendSilently() {
    if (!window.AuthService || typeof window.AuthService.refreshCurrentUserFromBackend !== "function") {
      return;
    }
    window.AuthService.refreshCurrentUserFromBackend()
      .then(function (refreshedUser) {
        if (!refreshedUser) {
          return;
        }
        state.user = refreshedUser;
        renderAll();
      })
      .catch(function () {
        return null;
      });
  }

  async function handleSectionNavClick(event) {
    var button = event.target.closest("button[data-section]");
    if (!button) {
      return;
    }
    var sectionName = button.getAttribute("data-section");
    if (!sectionName) {
      return;
    }
    if (sectionName === "export" && state.activeSection !== "export") {
      var isVerified = await promptForDataVaultPin();
      if (!isVerified) {
        return;
      }
    }
    setActiveSection(sectionName);
  }

  async function promptForDataVaultPin() {
    if (!hasPinConfigured()) {
      openPinSettingsModal();
      setChangePinMessage("Set a 4 to 6 digit PIN to unlock Data Vault.", true);
      return false;
    }

    var promptErrorText = "";
    while (true) {
      var pin = await openProtectedPromptModal({
        title: "Unlock Data Vault",
        message: "Enter your 4 to 6 digit PIN to continue.",
        label: "Security PIN",
        placeholder: "Enter PIN",
        confirmLabel: "Unlock",
        autocomplete: "off",
        inputType: "password",
        inputMode: "numeric",
        minLength: 4,
        maxLength: 6,
        errorText: promptErrorText,
        validate: function (value) {
          if (!value) {
            return "PIN is required.";
          }
          if (!/^\d{4,6}$/.test(value)) {
            return "PIN must be 4 to 6 digits.";
          }
          return "";
        }
      });

      if (!pin) {
        return false;
      }

      try {
        window.AuthService.unlockSession(pin);
        return true;
      } catch (error) {
        promptErrorText = error && error.message ? error.message : "Incorrect PIN.";
      }
    }
  }

  function setActiveSection(sectionName) {
    if (state.isSettingsMode) {
      state.lastAppSection = sectionName || state.lastAppSection || "overview";
      return;
    }
    var availableSections = (dom.appSections || []).map(function (section) {
      return section.getAttribute("data-app-section");
    });
    if (!availableSections.length) {
      return;
    }

    var targetSection = availableSections.indexOf(sectionName) === -1 ? "overview" : sectionName;
    state.activeSection = targetSection;
    if (targetSection !== "transactions") {
      closeAllTransactionsModal();
      closeTransactionRecord();
    }

    (dom.appSections || []).forEach(function (section) {
      var isActive = section.getAttribute("data-app-section") === targetSection;
      section.classList.toggle("section-hidden", !isActive);
    });

    (dom.sectionButtons || []).forEach(function (button) {
      var isActive = button.getAttribute("data-section") === targetSection;
      button.classList.toggle("active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    updateQuickAddVisibility();

    if (targetSection === "analytics" && state.user) {
      renderCharts();
    }
  }

  function updateQuickAddVisibility() {
    var isAppVisible = dom.appView && !dom.appView.classList.contains("hidden");
    var shouldShow = isAppVisible && !state.isSettingsMode && state.activeSection === "transactions";
    dom.quickAddFab.classList.toggle("hidden", !shouldShow);
  }

  function syncSidebarNavigationMode(isApp) {
    var showSettingsSidebar = Boolean(isApp && state.isSettingsMode);
    if (dom.sectionNav) {
      dom.sectionNav.classList.toggle("hidden", !isApp || showSettingsSidebar);
    }
    if (dom.settingsSidebarNav) {
      dom.settingsSidebarNav.classList.toggle("hidden", !showSettingsSidebar);
    }
  }

  function showView(view) {
    var isAuth = view === "auth";
    var isPin = view === "pin";
    var isApp = view === "app";
    if (!isApp) {
      closeAllTransactionsModal();
      closeTransactionRecord();
      closeSettingsPanel();
    }
    if (!isAuth) {
      closeForgotPasswordModal();
    }
    dom.authView.classList.toggle("hidden", !isAuth);
    dom.pinUnlockView.classList.toggle("hidden", !isPin);
    dom.appView.classList.toggle("hidden", !isApp);
    syncSidebarNavigationMode(isApp);
    dom.logoutBtn.classList.toggle("hidden", !isApp);
    if (dom.editProfileBtn) {
      dom.editProfileBtn.classList.toggle("hidden", !isApp);
    }
    dom.lockBtn.classList.toggle("hidden", !isApp || !hasPinConfigured());
    updateQuickAddVisibility();
    if (isApp) {
      syncAutoLockTimerState();
    } else {
      clearAutoLockInactivityTimer();
    }
    if (isPin) {
      refreshPinUnlockStatusUi();
      startPinUnlockStatusTicker();
    } else {
      clearPinUnlockStatusTicker();
    }
  }

  function hasPinConfigured() {
    return Boolean(
      state.user &&
      (
        (state.user.settings && state.user.settings.pinHash) ||
        state.user.pinHash
      )
    );
  }

  function renderAll() {
    if (!state.user) {
      return;
    }
    state.user = window.AuthService.getCurrentUser();
    populateDropdowns();
    renderUserHeader();
    renderStats();
    renderTransactionsTable();
    renderCategories();
    renderAccounts();
    renderBudgets();
    renderGoals();
    renderReminders();
    renderRecurringRules();
    renderInsights();
    renderCharts();
    syncAutoLockTimerState();
  }

  function renderUserHeader() {
    var displayName = getUserDisplayName(state.user);
    dom.userNameBadge.textContent = displayName;
    dom.userBadge.textContent = state.user.email;
    dom.userAvatar.textContent = getUserInitials(displayName, state.user.email);
    dom.defaultCurrency.value = state.user.settings && state.user.settings.currency ? state.user.settings.currency : "INR";
    dom.lockBtn.classList.toggle("hidden", !hasPinConfigured());
  }

  function getUserDisplayName(user) {
    var custom = String(user && user.profileName ? user.profileName : "").trim();
    if (custom) {
      return custom;
    }
    var email = String(user && user.email ? user.email : "").trim();
    if (!email) {
      return "Profile";
    }
    return email.split("@")[0] || email;
  }

  function getUserInitials(displayName, email) {
    var label = String(displayName || "").trim();
    if (!label) {
      label = String(email || "").trim().split("@")[0] || "";
    }
    if (!label) {
      return "--";
    }
    var words = label.replace(/[^a-zA-Z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    return label.slice(0, 2).toUpperCase();
  }

  function handleTransactionSubmit(event) {
    event.preventDefault();
    if (!state.user) {
      return;
    }

    var transactionId = dom.transactionId.value;
    var type = dom.transactionType.value;
    var amount = toAmount(dom.transactionAmount.value);
    var date = dom.transactionDate.value || toDateInputValue(new Date());
    var selectedCategory = dom.transactionCategory.value;
    var notes = String(dom.transactionNotes.value || "").trim();
    var tags = parseTags(dom.transactionTags.value);
    var accountId = dom.transactionAccount.value || getDefaultAccountId();

    if (amount <= 0) {
      setAppMessage("Amount must be greater than 0.", true);
      return;
    }

    var categoryId = selectedCategory;
    if (!selectedCategory || selectedCategory === AUTO_CATEGORY_VALUE) {
      categoryId = inferCategoryId(type, notes);
    }

    var recurringEnabled = dom.isRecurringTransaction.checked;
    var recurringFrequency = dom.recurringFrequency.value;

    updateUser(function (user) {
      if (transactionId) {
        var existing = user.transactions.find(function (item) {
          return item.id === transactionId;
        });
        if (!existing) {
          throw new Error("Transaction not found.");
        }
        existing.type = type;
        existing.amount = amount;
        existing.date = date;
        existing.categoryId = categoryId;
        existing.notes = notes;
        existing.tags = tags;
        existing.accountId = accountId;
        existing.updatedAt = new Date().toISOString();
      } else {
        user.transactions.push({
          id: window.FinanceStorage.createId("txn"),
          type: type,
          amount: amount,
          date: date,
          categoryId: categoryId,
          notes: notes,
          tags: tags,
          accountId: accountId,
          createdAt: new Date().toISOString()
        });
      }

      if (recurringEnabled && !transactionId) {
        user.recurringRules.push({
          id: window.FinanceStorage.createId("rec"),
          active: true,
          frequency: recurringFrequency,
          nextDate: shiftDate(date, recurringFrequency),
          startDate: date,
          title: notes || getCategoryName(categoryId),
          type: type,
          amount: amount,
          categoryId: categoryId,
          notes: notes,
          tags: tags,
          accountId: accountId,
          createdAt: new Date().toISOString()
        });
      }
      return user;
    });

    resetTransactionForm();
    setAppMessage("Transaction saved.", false);
    renderAll();
  }

  function handleDetectTransactionClick() {
    if (!state.user || !dom.transactionDetectInput) {
      return;
    }

    var sourceText = String(dom.transactionDetectInput.value || "").trim();
    if (!sourceText) {
      setTransactionDetectMessage("Paste a bank/SMS line to auto detect fields.", "error");
      return;
    }

    try {
      var detected = detectTransactionFromRawText(sourceText);
      dom.transactionType.value = detected.type;
      populateTransactionCategorySelect(detected.type, detected.categoryId || AUTO_CATEGORY_VALUE);
      dom.transactionAmount.value = detected.amount.toFixed(2);
      dom.transactionDate.value = detected.date;
      dom.transactionNotes.value = detected.notes;
      dom.transactionTags.value = (detected.tags || []).join(", ");
      populateAccountsSelect(detected.accountId || getDefaultAccountId());
      dom.transactionAccount.value = detected.accountId || getDefaultAccountId();

      var duplicate = findPotentialDuplicateTransaction(detected);
      var message = "Detected " + capitalize(detected.type) + " " + formatMoney(detected.amount) + " on " + formatDate(detected.date) + ". Review and save.";
      if (detected.dateWasGuessed) {
        message += " Date defaulted to today.";
      }
      if (duplicate) {
        message += " Similar transaction already exists.";
        setTransactionDetectMessage(message, "warning");
        return;
      }
      setTransactionDetectMessage(message, "success");
    } catch (error) {
      setTransactionDetectMessage(error.message || "Could not detect transaction details.", "error");
    }
  }

  function resetTransactionForm() {
    dom.transactionForm.reset();
    dom.transactionId.value = "";
    dom.transactionDate.value = toDateInputValue(new Date());
    dom.transactionType.value = "expense";
    populateTransactionCategorySelect("expense", AUTO_CATEGORY_VALUE);
    dom.transactionAccount.value = getDefaultAccountId();
    if (dom.transactionDetectInput) {
      dom.transactionDetectInput.value = "";
    }
    setTransactionDetectMessage("", "");
    dom.cancelEditBtn.classList.add("hidden");
    dom.editIndicator.classList.add("hidden");
  }

  function handleTransactionsTableClick(event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    var action = button.getAttribute("data-action");
    var transactionId = button.getAttribute("data-id");
    if (!transactionId) {
      return;
    }

    if (action === "edit-transaction") {
      closeAllTransactionsModal();
      openTransactionEditor(transactionId);
      return;
    }
    if (action === "view-transaction") {
      closeAllTransactionsModal();
      openTransactionRecord(transactionId);
      return;
    }
    if (action === "delete-transaction") {
      deleteTransaction(transactionId);
    }
  }

  function handleAllTransactionsModalClick(event) {
    var actionButton = event.target.closest("[data-action]");
    if (!actionButton || !dom.allTransactionsModal || !dom.allTransactionsModal.contains(actionButton)) {
      return;
    }
    var action = actionButton.getAttribute("data-action");
    if (action === "close-all-transactions-modal") {
      closeAllTransactionsModal();
    }
  }

  function openAllTransactionsModal() {
    if (!dom.allTransactionsModal) {
      return;
    }
    renderTransactionsTable();
    dom.allTransactionsModal.classList.remove("hidden");
    dom.allTransactionsModal.setAttribute("aria-hidden", "false");
    syncBodyModalState();
  }

  function closeAllTransactionsModal() {
    if (!dom.allTransactionsModal) {
      return;
    }
    dom.allTransactionsModal.classList.add("hidden");
    dom.allTransactionsModal.setAttribute("aria-hidden", "true");
    syncBodyModalState();
  }

  function syncBodyModalState() {
    var hasAllTransactionsModal = dom.allTransactionsModal && !dom.allTransactionsModal.classList.contains("hidden");
    var hasRecordModal = dom.transactionRecordModal && !dom.transactionRecordModal.classList.contains("hidden");
    var hasForgotPasswordModal = dom.forgotPasswordModal && !dom.forgotPasswordModal.classList.contains("hidden");
    var hasProtectedPromptModal = dom.protectedPromptModal && !dom.protectedPromptModal.classList.contains("hidden");
    document.body.classList.toggle("modal-open", Boolean(hasAllTransactionsModal || hasRecordModal || hasForgotPasswordModal || hasProtectedPromptModal));
  }

  function handleTransactionRecordModalClick(event) {
    var actionButton = event.target.closest("[data-action]");
    if (!actionButton || !dom.transactionRecordModal || !dom.transactionRecordModal.contains(actionButton)) {
      return;
    }
    var action = actionButton.getAttribute("data-action");
    var transactionId = dom.transactionRecordModal.getAttribute("data-id");

    if (action === "close-transaction-record") {
      closeTransactionRecord();
      return;
    }
    if (!transactionId) {
      return;
    }
    if (action === "record-edit-transaction") {
      closeTransactionRecord();
      openTransactionEditor(transactionId);
      return;
    }
    if (action === "record-delete-transaction") {
      closeTransactionRecord();
      deleteTransaction(transactionId);
    }
  }

  function handleGlobalKeyDown(event) {
    if (event.key !== "Escape") {
      return;
    }
    if (dom.settingsPanel && !dom.settingsPanel.classList.contains("hidden")) {
      closeSettingsPanel();
      return;
    }
    if (dom.protectedPromptModal && !dom.protectedPromptModal.classList.contains("hidden")) {
      closeProtectedPromptModal(null);
      return;
    }
    if (dom.forgotPasswordModal && !dom.forgotPasswordModal.classList.contains("hidden")) {
      closeForgotPasswordModal();
      return;
    }
    if (dom.transactionRecordModal && !dom.transactionRecordModal.classList.contains("hidden")) {
      closeTransactionRecord();
      return;
    }
    if (dom.allTransactionsModal && !dom.allTransactionsModal.classList.contains("hidden")) {
      closeAllTransactionsModal();
    }
  }

  function openTransactionRecord(transactionId) {
    if (!dom.transactionRecordModal || !dom.transactionRecordBody) {
      return;
    }
    var transaction = (state.user.transactions || []).find(function (item) {
      return item.id === transactionId;
    });
    if (!transaction) {
      return;
    }

    var typeLabel = capitalize(transaction.type);
    var typeClass = transaction.type === "income" ? "income" : "expense";
    var tags = transaction.tags || [];
    var tagsMarkup = tags.length
      ? "<div class='record-tags'>" + tags.map(function (tag) {
        return "<span class='record-tag'>" + escapeHtml(tag) + "</span>";
      }).join("") + "</div>"
      : "<span class='record-empty'>No tags</span>";
    var notesText = String(transaction.notes || "").trim();
    var notesMarkup = notesText ? escapeHtml(notesText).replace(/\n/g, "<br>") : "<span class='record-empty'>No notes added</span>";
    var createdMarkup = transaction.createdAt
      ? escapeHtml(formatDateTime(transaction.createdAt))
      : "<span class='record-empty'>Not available</span>";
    var updatedMarkup = transaction.updatedAt
      ? escapeHtml(formatDateTime(transaction.updatedAt))
      : "<span class='record-empty'>Not edited yet</span>";

    dom.transactionRecordBody.innerHTML = [
      "<div class='record-hero record-field full'>",
      "<div>",
      "<span class='record-field-label'>Amount</span>",
      "<div class='record-amount mono ", typeClass, "'>", escapeHtml(formatMoney(transaction.amount)), "</div>",
      "</div>",
      "<span class='record-type-pill ", typeClass, "'>", escapeHtml(typeLabel), "</span>",
      "</div>",
      buildTransactionRecordField("Date", escapeHtml(formatDate(transaction.date))),
      buildTransactionRecordField("Category", escapeHtml(getCategoryName(transaction.categoryId))),
      buildTransactionRecordField("Account", escapeHtml(getAccountName(transaction.accountId))),
      buildTransactionRecordField("Tags", tagsMarkup),
      buildTransactionRecordField("Created", createdMarkup),
      buildTransactionRecordField("Last Updated", updatedMarkup),
      buildTransactionRecordField("Notes", notesMarkup, true)
    ].join("");

    dom.transactionRecordMeta.textContent = "ID: " + transaction.id;
    dom.transactionRecordModal.setAttribute("data-id", transaction.id);
    dom.transactionRecordModal.classList.remove("hidden");
    dom.transactionRecordModal.setAttribute("aria-hidden", "false");
    syncBodyModalState();
    if (dom.transactionRecordEditBtn) {
      dom.transactionRecordEditBtn.focus();
    }
  }

  function buildTransactionRecordField(label, valueMarkup, fullWidth) {
    return [
      "<div class='record-field", fullWidth ? " full" : "", "'>",
      "<span class='record-field-label'>", escapeHtml(label), "</span>",
      "<div class='record-field-value'>", valueMarkup, "</div>",
      "</div>"
    ].join("");
  }

  function closeTransactionRecord() {
    if (!dom.transactionRecordModal) {
      return;
    }
    dom.transactionRecordModal.classList.add("hidden");
    dom.transactionRecordModal.setAttribute("aria-hidden", "true");
    dom.transactionRecordModal.removeAttribute("data-id");
    if (dom.transactionRecordMeta) {
      dom.transactionRecordMeta.textContent = "ID: -";
    }
    if (dom.transactionRecordBody) {
      dom.transactionRecordBody.innerHTML = "";
    }
    syncBodyModalState();
  }

  function handleSettingsSidebarNavClick(event) {
    var actionButton = event.target.closest("[data-action]");
    if (actionButton && actionButton.getAttribute("data-action") === "close-settings-mode") {
      closeSettingsPanel();
      return;
    }
    var navButton = event.target.closest("[data-settings-nav]");
    if (!navButton || !dom.settingsSidebarNav || !dom.settingsSidebarNav.contains(navButton)) {
      return;
    }
    setSettingsSection(navButton.getAttribute("data-settings-nav"));
  }

  function handleSettingsWorkspaceClick(event) {
    var actionButton = event.target.closest("[data-action]");
    if (!actionButton || !dom.settingsPanel || !dom.settingsPanel.contains(actionButton)) {
      return;
    }
    if (actionButton.getAttribute("data-action") === "close-settings-mode") {
      closeSettingsPanel();
    }
  }

  function openSettingsPanel(sectionName) {
    if (!state.user || !dom.settingsPanel) {
      return;
    }

    if (!state.isSettingsMode) {
      state.lastAppSection = state.activeSection || "overview";
    }
    state.isSettingsMode = true;
    closeAllTransactionsModal();
    closeTransactionRecord();
    dom.settingsPanel.classList.remove("hidden");
    dom.settingsPanel.setAttribute("aria-hidden", "false");
    dom.settingsPanel.scrollTop = 0;
    (dom.appSections || []).forEach(function (section) {
      section.classList.add("section-hidden");
    });
    hydrateSettingsProfileForm();
    hydrateAutoLockSettingsForm();
    setSettingsSection(sectionName || state.activeSettingsSection || "profile");
    syncSidebarNavigationMode(true);
    updateQuickAddVisibility();

    requestAnimationFrame(function () {
      focusActiveSettingsField();
    });
  }

  function closeSettingsPanel() {
    if (!dom.settingsPanel) {
      return;
    }
    var wasSettingsMode = state.isSettingsMode;
    state.isSettingsMode = false;
    dom.settingsPanel.classList.add("hidden");
    dom.settingsPanel.setAttribute("aria-hidden", "true");
    if (dom.changePasswordForm) {
      dom.changePasswordForm.reset();
    }
    if (dom.changePinForm) {
      dom.changePinForm.reset();
    }
    setProfileFormMessage("", false);
    setChangePasswordMessage("", false);
    setChangePinMessage("", false);
    setAutoLockMessage("", false);
    syncSidebarNavigationMode(Boolean(dom.appView && !dom.appView.classList.contains("hidden")));
    if (wasSettingsMode && dom.appView && !dom.appView.classList.contains("hidden")) {
      setActiveSection(state.lastAppSection || state.activeSection || "overview");
    }
  }

  function setSettingsSection(sectionName) {
    var nextSection = String(sectionName || "profile");
    var hasMatch = false;
    (dom.settingsSectionPanels || []).forEach(function (panel) {
      var panelKey = panel.getAttribute("data-settings-panel");
      var isActive = panelKey === nextSection;
      if (isActive) {
        hasMatch = true;
      }
      panel.classList.toggle("hidden", !isActive);
    });
    if (!hasMatch) {
      nextSection = "profile";
      (dom.settingsSectionPanels || []).forEach(function (panel) {
        panel.classList.toggle("hidden", panel.getAttribute("data-settings-panel") !== "profile");
      });
    }
    state.activeSettingsSection = nextSection;
    (dom.settingsNavButtons || []).forEach(function (button) {
      var isActive = button.getAttribute("data-settings-nav") === nextSection;
      button.classList.toggle("active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }

  function focusActiveSettingsField() {
    if (!dom.settingsPanel || dom.settingsPanel.classList.contains("hidden")) {
      return;
    }
    var activeSection = (dom.settingsNavButtons || []).find(function (button) {
      return button.classList.contains("active");
    });
    var sectionName = activeSection ? activeSection.getAttribute("data-settings-nav") : "profile";

    if (sectionName === "password" && dom.currentPasswordInput) {
      dom.currentPasswordInput.focus();
      return;
    }
    if (sectionName === "pin" && dom.newPinInput) {
      dom.newPinInput.focus();
      return;
    }
    if (sectionName === "autolock" && dom.autoLockEnabledInput) {
      dom.autoLockEnabledInput.focus();
      return;
    }
    if (dom.profileNameInput) {
      dom.profileNameInput.focus();
      if (dom.profileNameInput.value) {
        dom.profileNameInput.select();
      }
    }
  }

  function hydrateSettingsProfileForm() {
    if (!state.user || !dom.profileForm) {
      return;
    }
    dom.profileNameInput.value = String(state.user.profileName || "").trim();
    dom.profileEmailInput.value = String(state.user.email || "").trim();
    setProfileFormMessage("", false);
  }

  function hydrateAutoLockSettingsForm() {
    if (!dom.autoLockEnabledInput || !dom.autoLockMinutesInput || !state.user) {
      return;
    }
    var settings = state.user.settings || {};
    var enabled = Boolean(settings.autoLockEnabled);
    var minutes = getAutoLockMinutes(settings);
    dom.autoLockEnabledInput.checked = enabled;
    dom.autoLockMinutesInput.value = String(minutes);
    dom.autoLockMinutesInput.disabled = !enabled;
    setAutoLockMessage("", false);
    updateAutoLockCountdownUi();
  }

  function handleAutoLockToggleChange() {
    if (!dom.autoLockEnabledInput || !dom.autoLockMinutesInput) {
      return;
    }
    dom.autoLockMinutesInput.disabled = !dom.autoLockEnabledInput.checked;
    updateAutoLockCountdownUi();
  }

  function openProfileModal() {
    openSettingsPanel("profile");
  }

  function closeProfileModal() {
    closeSettingsPanel();
  }

  function openChangePasswordModal() {
    if (dom.changePasswordForm) {
      dom.changePasswordForm.reset();
    }
    setChangePasswordMessage("", false);
    openSettingsPanel("password");
  }

  function closeChangePasswordModal() {
    if (dom.changePasswordForm) {
      dom.changePasswordForm.reset();
    }
    setChangePasswordMessage("", false);
    closeSettingsPanel();
  }

  function openPinSettingsModal() {
    if (dom.changePinForm) {
      dom.changePinForm.reset();
    }
    setChangePinMessage("", false);
    openSettingsPanel("pin");
  }

  function closePinSettingsModal() {
    if (dom.changePinForm) {
      dom.changePinForm.reset();
    }
    setChangePinMessage("", false);
    closeSettingsPanel();
  }

  function handleProfileFormSubmit(event) {
    event.preventDefault();
    if (!state.user) {
      return;
    }

    var profileName = String(dom.profileNameInput.value || "").trim();
    var nextEmail = String(dom.profileEmailInput.value || "").trim().toLowerCase();

    if (!nextEmail) {
      setProfileFormMessage("Email is required.", true);
      return;
    }
    if (!isValidEmailAddress(nextEmail)) {
      setProfileFormMessage("Enter a valid email address.", true);
      return;
    }

    try {
      updateUser(function (user) {
        var existing = window.FinanceStorage.findUserByEmail(nextEmail);
        if (existing && existing.id !== user.id) {
          throw new Error("Another account already uses this email.");
        }
        user.profileName = profileName;
        user.email = nextEmail;
        user.updatedAt = new Date().toISOString();
        return user;
      }, false);

      state.user = window.AuthService.getCurrentUser();
      renderUserHeader();
      setProfileFormMessage("Profile updated successfully.", false);
    } catch (error) {
      setProfileFormMessage(error.message, true);
    }
  }

  function setProfileFormMessage(message, isError) {
    if (!dom.profileFormMessage) {
      return;
    }
    dom.profileFormMessage.textContent = message || "";
    dom.profileFormMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  async function handleChangePasswordFormSubmit(event) {
    event.preventDefault();
    if (!state.user) {
      return;
    }

    var currentPassword = String(dom.currentPasswordInput.value || "");
    var newPassword = String(dom.newPasswordInput.value || "");
    var confirmPassword = String(dom.confirmPasswordInput.value || "");

    if (!currentPassword.trim()) {
      setChangePasswordMessage("Current password is required.", true);
      return;
    }
    if (newPassword.trim().length < 6) {
      setChangePasswordMessage("New password must be at least 6 characters.", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordMessage("New password and confirm password do not match.", true);
      return;
    }
    if (currentPassword === newPassword) {
      setChangePasswordMessage("New password must be different from current password.", true);
      return;
    }

    try {
      await window.AuthService.changePassword({
        currentPassword: currentPassword,
        newPassword: newPassword
      });
      dom.changePasswordForm.reset();
      setChangePasswordMessage("Password changed successfully.", false);
    } catch (error) {
      setChangePasswordMessage(error.message || "Could not change password.", true);
    }
  }

  function setChangePasswordMessage(message, isError) {
    if (!dom.changePasswordMessage) {
      return;
    }
    dom.changePasswordMessage.textContent = message || "";
    dom.changePasswordMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  async function handleChangePinFormSubmit(event) {
    event.preventDefault();
    if (!state.user) {
      return;
    }

    var newPin = String(dom.newPinInput ? dom.newPinInput.value : "").trim();
    var confirmPin = String(dom.confirmPinInput ? dom.confirmPinInput.value : "").trim();

    if (!newPin) {
      setChangePinMessage("PIN is required.", true);
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      setChangePinMessage("PIN must be 4 to 6 digits.", true);
      return;
    }
    if (newPin !== confirmPin) {
      setChangePinMessage("PIN and confirm PIN do not match.", true);
      return;
    }

    try {
      window.AuthService.setPin(newPin);
      state.user = window.AuthService.getCurrentUser();
      renderUserHeader();
      syncAutoLockTimerState();
      if (dom.changePinForm) {
        dom.changePinForm.reset();
      }
      setChangePinMessage("PIN updated successfully.", false);
    } catch (error) {
      setChangePinMessage(error.message || "Could not update PIN.", true);
    }
  }

  function setChangePinMessage(message, isError) {
    if (!dom.changePinMessage) {
      return;
    }
    dom.changePinMessage.textContent = message || "";
    dom.changePinMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function handleAutoLockFormSubmit(event) {
    event.preventDefault();
    if (!state.user || !dom.autoLockEnabledInput || !dom.autoLockMinutesInput) {
      return;
    }

    var isEnabled = Boolean(dom.autoLockEnabledInput.checked);
    var minutes = parseInt(dom.autoLockMinutesInput.value, 10);

    if (isEnabled && !hasPinConfigured()) {
      setAutoLockMessage("Set a PIN first to use inactivity auto lock.", true);
      setSettingsSection("pin");
      return;
    }
    if (isEnabled && (!Number.isFinite(minutes) || minutes < 1)) {
      setAutoLockMessage("Select a valid auto lock time.", true);
      return;
    }

    try {
      updateUser(function (user) {
        user.settings = user.settings || {};
        user.settings.autoLockEnabled = isEnabled;
        user.settings.autoLockMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 5;
        user.updatedAt = new Date().toISOString();
        return user;
      }, false);

      state.user = window.AuthService.getCurrentUser();
      hydrateAutoLockSettingsForm();
      syncAutoLockTimerState();
      if (isEnabled) {
        setAutoLockMessage("Auto lock is enabled and will require PIN unlock.", false);
      } else {
        setAutoLockMessage("Auto lock is disabled.", false);
      }
    } catch (error) {
      setAutoLockMessage(error.message || "Could not update auto lock settings.", true);
    }
  }

  function setAutoLockMessage(message, isError) {
    if (!dom.autoLockMessage) {
      return;
    }
    dom.autoLockMessage.textContent = message || "";
    dom.autoLockMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function getAutoLockMinutes(settings) {
    var value = parseInt(settings && settings.autoLockMinutes, 10);
    if (!Number.isFinite(value) || value < 1) {
      return 5;
    }
    return value;
  }

  function isAutoLockEnabled(user) {
    return Boolean(
      user &&
      user.settings &&
      user.settings.autoLockEnabled &&
      hasPinConfigured() &&
      dom.appView &&
      !dom.appView.classList.contains("hidden")
    );
  }

  function clearAutoLockInactivityTimer() {
    if (inactivityLockTimerId) {
      clearTimeout(inactivityLockTimerId);
      inactivityLockTimerId = null;
    }
    if (autoLockCountdownIntervalId) {
      clearInterval(autoLockCountdownIntervalId);
      autoLockCountdownIntervalId = null;
    }
    inactivityLockDueAtMs = 0;
    updateAutoLockCountdownUi();
  }

  function updateAutoLockCountdownUi() {
    if (!dom.autoLockCountdown) {
      return;
    }
    if (!isAutoLockEnabled(state.user)) {
      dom.autoLockCountdown.textContent = "Disabled";
      return;
    }
    var remaining = inactivityLockDueAtMs - Date.now();
    if (remaining <= 0) {
      dom.autoLockCountdown.textContent = "Locking...";
      return;
    }
    dom.autoLockCountdown.textContent = formatDurationCountdown(remaining);
  }

  function startAutoLockCountdownTicker() {
    if (autoLockCountdownIntervalId) {
      clearInterval(autoLockCountdownIntervalId);
      autoLockCountdownIntervalId = null;
    }
    updateAutoLockCountdownUi();
    if (!isAutoLockEnabled(state.user) || !inactivityLockDueAtMs) {
      return;
    }
    autoLockCountdownIntervalId = setInterval(function () {
      updateAutoLockCountdownUi();
      if (inactivityLockDueAtMs <= Date.now()) {
        clearInterval(autoLockCountdownIntervalId);
        autoLockCountdownIntervalId = null;
      }
    }, 1000);
  }

  function syncAutoLockTimerState() {
    clearAutoLockInactivityTimer();
    if (!isAutoLockEnabled(state.user)) {
      updateAutoLockCountdownUi();
      return;
    }
    inactivityLockDueAtMs = Date.now() + getAutoLockMinutes(state.user && state.user.settings) * 60 * 1000;
    startAutoLockCountdownTicker();
    inactivityLockTimerId = setTimeout(function () {
      clearAutoLockInactivityTimer();
      if (!isAutoLockEnabled(state.user)) {
        return;
      }
      try {
        window.AuthService.lockSession();
        showView("pin");
        if (dom.pinUnlockForm) {
          dom.pinUnlockForm.reset();
        }
        if (dom.pinMessage) {
          dom.pinMessage.textContent = "App locked due to inactivity. Enter PIN to continue.";
          dom.pinMessage.style.color = "var(--muted)";
        }
        refreshPinUnlockStatusUi();
      } catch (error) {
        return;
      }
    }, Math.max(0, inactivityLockDueAtMs - Date.now()));
  }

  function handleAutoLockActivity() {
    if (!isAutoLockEnabled(state.user)) {
      return;
    }
    syncAutoLockTimerState();
  }

  function getPinSecurityStatus() {
    if (!window.AuthService || typeof window.AuthService.getPinSecurityStatus !== "function") {
      return {
        maxAttempts: 5,
        attemptsUsed: 0,
        attemptsLeft: 5,
        isBlocked: false,
        remainingMs: 0
      };
    }
    return window.AuthService.getPinSecurityStatus();
  }

  function refreshPinUnlockStatusUi() {
    if (!dom.unlockPin || !dom.unlockPinBtn || !dom.pinLockHint) {
      return;
    }
    var status = getPinSecurityStatus();
    var blocked = Boolean(status && status.isBlocked);
    dom.unlockPin.disabled = blocked;
    dom.unlockPinBtn.disabled = blocked;

    if (blocked) {
      dom.pinLockHint.textContent = "Locked for " + formatDurationCountdown(status.remainingMs) + " after too many incorrect attempts.";
      dom.pinLockHint.style.color = "var(--danger)";
      return;
    }

    var attemptsUsed = Number(status && status.attemptsUsed ? status.attemptsUsed : 0);
    if (attemptsUsed > 0) {
      dom.pinLockHint.textContent = Number(status && status.attemptsLeft != null ? status.attemptsLeft : 0) + " attempt(s) left before temporary lock.";
      dom.pinLockHint.style.color = "var(--warning)";
      return;
    }

    dom.pinLockHint.textContent = "";
    dom.pinLockHint.style.color = "var(--muted)";
  }

  function clearPinUnlockStatusTicker() {
    if (pinUnlockStatusTimerId) {
      clearInterval(pinUnlockStatusTimerId);
      pinUnlockStatusTimerId = null;
    }
  }

  function startPinUnlockStatusTicker() {
    clearPinUnlockStatusTicker();
    refreshPinUnlockStatusUi();
    pinUnlockStatusTimerId = setInterval(function () {
      if (!dom.pinUnlockView || dom.pinUnlockView.classList.contains("hidden")) {
        clearPinUnlockStatusTicker();
        return;
      }
      refreshPinUnlockStatusUi();
    }, 1000);
  }

  function formatDurationCountdown(ms) {
    var totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    if (minutes > 0) {
      return minutes + "m " + String(seconds).padStart(2, "0") + "s";
    }
    return seconds + "s";
  }

  function openForgotPasswordModal() {
    if (!dom.forgotPasswordModal || !dom.forgotPasswordForm) {
      return;
    }
    dom.forgotPasswordForm.reset();
    setForgotPasswordMessage("", false);
    setForgotPasswordCodeHint("", false);
    var preferredEmail = String(
      (state.user && state.user.email) ||
      (dom.profileEmailInput && dom.profileEmailInput.value) ||
      (dom.loginEmail && dom.loginEmail.value) ||
      ""
    ).trim().toLowerCase();
    if (preferredEmail) {
      dom.forgotPasswordEmailInput.value = preferredEmail;
    }

    dom.forgotPasswordModal.classList.remove("hidden");
    dom.forgotPasswordModal.setAttribute("aria-hidden", "false");
    syncBodyModalState();

    requestAnimationFrame(function () {
      if (dom.forgotPasswordEmailInput) {
        dom.forgotPasswordEmailInput.focus();
      }
    });
  }

  function closeForgotPasswordModal() {
    if (!dom.forgotPasswordModal) {
      return;
    }
    dom.forgotPasswordModal.classList.add("hidden");
    dom.forgotPasswordModal.setAttribute("aria-hidden", "true");
    if (dom.forgotPasswordForm) {
      dom.forgotPasswordForm.reset();
    }
    setForgotPasswordMessage("", false);
    setForgotPasswordCodeHint("", false);
    syncBodyModalState();
  }

  function handleForgotPasswordModalClick(event) {
    var actionButton = event.target.closest("[data-action]");
    if (!actionButton || !dom.forgotPasswordModal || !dom.forgotPasswordModal.contains(actionButton)) {
      return;
    }
    if (actionButton.getAttribute("data-action") === "close-forgot-password-modal") {
      closeForgotPasswordModal();
    }
  }

  async function handleRequestPasswordResetCode() {
    var email = String(dom.forgotPasswordEmailInput.value || "").trim().toLowerCase();
    if (!email) {
      setForgotPasswordMessage("Email is required.", true);
      return;
    }
    if (!isValidEmailAddress(email)) {
      setForgotPasswordMessage("Enter a valid email address.", true);
      return;
    }

    try {
      setForgotPasswordMessage("Requesting reset code...", false);
      var result = await window.AuthService.requestPasswordReset(email);
      var hint = result && result.message ? result.message : "If account exists, a reset code has been sent to your email.";
      if (result && result.expiresAt) {
        hint += " (expires " + formatDateTime(result.expiresAt) + ")";
      }
      setForgotPasswordCodeHint(hint, false);
      setForgotPasswordMessage("Check your email inbox for the reset code, then enter it below.", false);
      if (dom.forgotPasswordCodeInput) {
        dom.forgotPasswordCodeInput.focus();
      }
    } catch (error) {
      setForgotPasswordMessage(error.message || "Could not request reset code.", true);
    }
  }

  async function handleForgotPasswordFormSubmit(event) {
    event.preventDefault();
    var email = String(dom.forgotPasswordEmailInput.value || "").trim().toLowerCase();
    var code = String(dom.forgotPasswordCodeInput.value || "").trim();
    var newPassword = String(dom.forgotPasswordNewPasswordInput.value || "");
    var confirmPassword = String(dom.forgotPasswordConfirmPasswordInput.value || "");

    if (!email || !isValidEmailAddress(email)) {
      setForgotPasswordMessage("Enter a valid email address.", true);
      return;
    }
    if (!code) {
      setForgotPasswordMessage("Reset code is required.", true);
      return;
    }
    if (newPassword.trim().length < 6) {
      setForgotPasswordMessage("New password must be at least 6 characters.", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotPasswordMessage("New password and confirm password do not match.", true);
      return;
    }

    try {
      await window.AuthService.confirmPasswordReset({
        email: email,
        code: code,
        newPassword: newPassword
      });
      closeForgotPasswordModal();
      clearAutoLockInactivityTimer();
      window.AuthService.logout();
      state.user = null;
      syncViewFromSession();
      switchAuthTab("login");
      if (dom.loginEmail) {
        dom.loginEmail.value = email;
      }
      if (dom.loginPassword) {
        dom.loginPassword.focus();
      }
      setAuthMessage("Password reset successful. Please login with your new password.", false);
    } catch (error) {
      setForgotPasswordMessage(error.message || "Could not reset password.", true);
    }
  }

  function setForgotPasswordMessage(message, isError) {
    if (!dom.forgotPasswordMessage) {
      return;
    }
    dom.forgotPasswordMessage.textContent = message || "";
    dom.forgotPasswordMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function setForgotPasswordCodeHint(message, isError) {
    if (!dom.forgotPasswordCodeHint) {
      return;
    }
    dom.forgotPasswordCodeHint.textContent = message || "";
    dom.forgotPasswordCodeHint.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function handleProtectedPromptModalClick(event) {
    var actionButton = event.target.closest("[data-action]");
    if (!actionButton || !dom.protectedPromptModal || !dom.protectedPromptModal.contains(actionButton)) {
      return;
    }
    var action = actionButton.getAttribute("data-action");
    if (action === "close-protected-prompt") {
      closeProtectedPromptModal(null);
    }
  }

  function handleProtectedPromptSubmit(event) {
    event.preventDefault();
    if (!protectedPromptState) {
      return;
    }
    var entered = String(dom.protectedPromptInput ? dom.protectedPromptInput.value : "").trim();
    if (typeof protectedPromptState.validate === "function") {
      var validationMessage = protectedPromptState.validate(entered);
      if (validationMessage) {
        if (dom.protectedPromptError) {
          dom.protectedPromptError.textContent = validationMessage;
        }
        if (dom.protectedPromptInput) {
          dom.protectedPromptInput.focus();
          dom.protectedPromptInput.select();
        }
        return;
      }
    }
    closeProtectedPromptModal(entered);
  }

  function openProtectedPromptModal(options) {
    if (!dom.protectedPromptModal || !dom.protectedPromptForm || !dom.protectedPromptInput) {
      return Promise.resolve(null);
    }

    closeProtectedPromptModal(null);

    var config = options || {};
    dom.protectedPromptTitle.textContent = config.title || "Enter Password";
    dom.protectedPromptMessage.textContent = config.message || "Enter password to continue.";
    if (dom.protectedPromptLabel) {
      dom.protectedPromptLabel.textContent = config.label || "Password";
    }
    dom.protectedPromptInput.value = config.defaultValue || "";
    dom.protectedPromptInput.placeholder = config.placeholder || "";
    dom.protectedPromptInput.type = config.inputType || "password";
    if (config.inputMode) {
      dom.protectedPromptInput.setAttribute("inputmode", config.inputMode);
    } else {
      dom.protectedPromptInput.removeAttribute("inputmode");
    }
    if (typeof config.minLength === "number") {
      dom.protectedPromptInput.minLength = config.minLength;
    } else {
      dom.protectedPromptInput.removeAttribute("minlength");
    }
    if (typeof config.maxLength === "number") {
      dom.protectedPromptInput.maxLength = config.maxLength;
    } else {
      dom.protectedPromptInput.removeAttribute("maxlength");
    }
    dom.protectedPromptInput.autocomplete = config.autocomplete || "off";
    dom.protectedPromptInput.required = true;
    if (dom.protectedPromptOkBtn) {
      dom.protectedPromptOkBtn.textContent = config.confirmLabel || "OK";
    }
    if (dom.protectedPromptError) {
      dom.protectedPromptError.textContent = config.errorText || "";
    }

    dom.protectedPromptModal.classList.remove("hidden");
    dom.protectedPromptModal.setAttribute("aria-hidden", "false");
    syncBodyModalState();

    requestAnimationFrame(function () {
      dom.protectedPromptInput.focus();
      if (dom.protectedPromptInput.value) {
        dom.protectedPromptInput.select();
      }
    });

    return new Promise(function (resolve) {
      protectedPromptState = {
        resolve: resolve,
        validate: config.validate
      };
    });
  }

  function closeProtectedPromptModal(value) {
    if (!dom.protectedPromptModal) {
      if (protectedPromptState && typeof protectedPromptState.resolve === "function") {
        protectedPromptState.resolve(value);
      }
      protectedPromptState = null;
      return;
    }

    if (!dom.protectedPromptModal.classList.contains("hidden")) {
      dom.protectedPromptModal.classList.add("hidden");
      dom.protectedPromptModal.setAttribute("aria-hidden", "true");
    }
    if (dom.protectedPromptError) {
      dom.protectedPromptError.textContent = "";
    }
    if (dom.protectedPromptForm) {
      dom.protectedPromptForm.reset();
    }
    syncBodyModalState();

    if (protectedPromptState && typeof protectedPromptState.resolve === "function") {
      protectedPromptState.resolve(value);
    }
    protectedPromptState = null;
  }

  function openTransactionEditor(transactionId) {
    var transaction = (state.user.transactions || []).find(function (item) {
      return item.id === transactionId;
    });
    if (!transaction) {
      return;
    }

    dom.transactionId.value = transaction.id;
    dom.transactionType.value = transaction.type;
    populateTransactionCategorySelect(transaction.type, transaction.categoryId);
    dom.transactionAmount.value = transaction.amount;
    dom.transactionDate.value = transaction.date;
    dom.transactionTags.value = (transaction.tags || []).join(", ");
    dom.transactionNotes.value = transaction.notes || "";
    dom.transactionAccount.value = transaction.accountId || getDefaultAccountId();
    dom.isRecurringTransaction.checked = false;
    if (dom.transactionDetectInput) {
      dom.transactionDetectInput.value = "";
    }
    setTransactionDetectMessage("", "");
    dom.cancelEditBtn.classList.remove("hidden");
    dom.editIndicator.classList.remove("hidden");
    setActiveSection("transactions");
    byId("quickAddPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteTransaction(transactionId) {
    if (dom.transactionRecordModal && dom.transactionRecordModal.getAttribute("data-id") === transactionId) {
      closeTransactionRecord();
    }
    updateUser(function (user) {
      user.transactions = window.FinanceStorage.removeItemById(user.transactions, transactionId);
      return user;
    });
    setAppMessage("Transaction deleted.", false);
    renderAll();
  }

  function handleFiltersSubmit(event) {
    event.preventDefault();
    state.filters = {
      keyword: String(dom.filterKeyword.value || "").trim().toLowerCase(),
      categoryId: dom.filterCategory.value,
      type: dom.filterType.value,
      minAmount: dom.filterMinAmount.value,
      maxAmount: dom.filterMaxAmount.value,
      fromDate: dom.filterFromDate.value,
      toDate: dom.filterToDate.value,
      tag: String(dom.filterTag.value || "").trim().toLowerCase()
    };
    renderTransactionsTable();
    renderCharts();
  }

  function clearFilters() {
    dom.filtersForm.reset();
    state.filters = {
      keyword: "",
      categoryId: "",
      type: "",
      minAmount: "",
      maxAmount: "",
      fromDate: "",
      toDate: "",
      tag: ""
    };
    renderTransactionsTable();
    renderCharts();
  }

  function handleAddCategory(event) {
    event.preventDefault();
    var name = String(dom.newCategoryName.value || "").trim();
    var type = dom.newCategoryType.value;
    if (!name) {
      return;
    }
    try {
      updateUser(function (user) {
        var exists = user.categories.some(function (category) {
          return category.type === type && category.name.toLowerCase() === name.toLowerCase();
        });
        if (exists) {
          throw new Error("Category already exists.");
        }
        user.categories.push({
          id: window.FinanceStorage.createId("cat"),
          name: name,
          type: type,
          system: false
        });
        return user;
      });
      dom.categoryForm.reset();
      setAppMessage("Category added.", false);
      renderAll();
    } catch (error) {
      setAppMessage(error.message, true);
    }
  }

  function handleCategoriesListClick(event) {
    var button = event.target.closest("button[data-action]");
    if (!button || button.getAttribute("data-action") !== "remove-category") {
      return;
    }
    var categoryId = button.getAttribute("data-id");
    if (!categoryId) {
      return;
    }
    try {
      updateUser(function (user) {
        var target = user.categories.find(function (category) {
          return category.id === categoryId;
        });
        if (!target) {
          return user;
        }
        if (target.system) {
          throw new Error("Default categories cannot be removed.");
        }
        var inUse = user.transactions.some(function (tx) {
          return tx.categoryId === categoryId;
        }) || user.budgets.some(function (budget) {
          return budget.categoryId === categoryId;
        }) || user.recurringRules.some(function (rule) {
          return rule.categoryId === categoryId;
        });
        if (inUse) {
          throw new Error("Category is currently in use.");
        }
        user.categories = window.FinanceStorage.removeItemById(user.categories, categoryId);
        return user;
      });
      setAppMessage("Category removed.", false);
      renderAll();
    } catch (error) {
      setAppMessage(error.message, true);
    }
  }

  function handleAddAccount(event) {
    event.preventDefault();
    var name = String(dom.newAccountName.value || "").trim();
    var type = dom.newAccountType.value;
    var initialBalance = toAmount(dom.newAccountInitialBalance.value || "0");
    if (!name) {
      return;
    }
    try {
      updateUser(function (user) {
        var exists = user.accounts.some(function (account) {
          return account.name.toLowerCase() === name.toLowerCase();
        });
        if (exists) {
          throw new Error("Account already exists.");
        }
        user.accounts.push({
          id: window.FinanceStorage.createId("acct"),
          name: name,
          type: type,
          initialBalance: initialBalance
        });
        return user;
      });
      dom.accountForm.reset();
      setAppMessage("Account added.", false);
      renderAll();
    } catch (error) {
      setAppMessage(error.message, true);
    }
  }

  function handleAccountsListClick(event) {
    var button = event.target.closest("button[data-action]");
    if (!button || button.getAttribute("data-action") !== "remove-account") {
      return;
    }
    var accountId = button.getAttribute("data-id");
    if (!accountId) {
      return;
    }

    try {
      updateUser(function (user) {
        if (user.accounts.length <= 1) {
          throw new Error("At least one account is required.");
        }
        var inUse = user.transactions.some(function (transaction) {
          return transaction.accountId === accountId;
        }) || user.recurringRules.some(function (rule) {
          return rule.accountId === accountId;
        });
        if (inUse) {
          throw new Error("Account is linked to transactions.");
        }
        user.accounts = window.FinanceStorage.removeItemById(user.accounts, accountId);
        return user;
      });
      setAppMessage("Account removed.", false);
      renderAll();
    } catch (error) {
      setAppMessage(error.message, true);
    }
  }

  function handleCurrencyChange() {
    var currency = dom.defaultCurrency.value || "INR";
    updateUser(function (user) {
      user.settings = user.settings || {};
      user.settings.currency = currency;
      return user;
    });
    renderAll();
  }

  function handleBudgetSubmit(event) {
    event.preventDefault();
    var categoryId = dom.budgetCategory.value;
    var limit = toAmount(dom.budgetLimit.value);
    var month = getCurrentMonthKey();
    if (!categoryId || limit <= 0) {
      setAppMessage("Select a category and budget above 0.", true);
      return;
    }
    updateUser(function (user) {
      var existing = user.budgets.find(function (budget) {
        return budget.categoryId === categoryId && budget.month === month;
      });
      if (existing) {
        existing.limit = limit;
        existing.updatedAt = new Date().toISOString();
      } else {
        user.budgets.push({
          id: window.FinanceStorage.createId("bdg"),
          categoryId: categoryId,
          month: month,
          limit: limit,
          createdAt: new Date().toISOString()
        });
      }
      return user;
    });
    dom.budgetForm.reset();
    setAppMessage("Budget saved for " + month + ".", false);
    renderAll();
  }

  function handleBudgetsListClick(event) {
    var button = event.target.closest("button[data-action]");
    if (!button || button.getAttribute("data-action") !== "remove-budget") {
      return;
    }
    var budgetId = button.getAttribute("data-id");
    if (!budgetId) {
      return;
    }
    updateUser(function (user) {
      user.budgets = window.FinanceStorage.removeItemById(user.budgets, budgetId);
      return user;
    });
    setAppMessage("Budget removed.", false);
    renderAll();
  }

  function handleGoalSubmit(event) {
    event.preventDefault();
    var name = String(dom.goalName.value || "").trim();
    var target = toAmount(dom.goalTarget.value);
    var deadline = dom.goalDeadline.value || "";
    if (!name || target <= 0) {
      setAppMessage("Goal name and positive target are required.", true);
      return;
    }
    updateUser(function (user) {
      user.goals.push({
        id: window.FinanceStorage.createId("goal"),
        name: name,
        target: target,
        saved: 0,
        deadline: deadline,
        createdAt: new Date().toISOString()
      });
      return user;
    });
    dom.goalForm.reset();
    setAppMessage("Goal added.", false);
    renderAll();
  }

  function handleGoalsListClick(event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    var action = button.getAttribute("data-action");
    var goalId = button.getAttribute("data-id");
    if (!goalId) {
      return;
    }

    if (action === "remove-goal") {
      updateUser(function (user) {
        user.goals = window.FinanceStorage.removeItemById(user.goals, goalId);
        return user;
      });
      setAppMessage("Goal removed.", false);
      renderAll();
      return;
    }

    if (action === "add-goal-funds") {
      var rawAmount = window.prompt("How much do you want to add to this goal?", "1000");
      if (rawAmount == null) {
        return;
      }
      var amount = toAmount(rawAmount);
      if (amount <= 0) {
        setAppMessage("Contribution amount must be above 0.", true);
        return;
      }
      updateUser(function (user) {
        var goal = user.goals.find(function (item) {
          return item.id === goalId;
        });
        if (!goal) {
          return user;
        }
        goal.saved = toAmount(goal.saved) + amount;
        goal.updatedAt = new Date().toISOString();
        return user;
      });
      setAppMessage("Goal updated.", false);
      renderAll();
    }
  }

  function handleReminderSubmit(event) {
    event.preventDefault();
    var title = String(dom.reminderTitle.value || "").trim();
    var amount = toAmount(dom.reminderAmount.value || "0");
    var dueDate = dom.reminderDate.value;
    var frequency = dom.reminderFrequency.value;
    if (!title || !dueDate) {
      setAppMessage("Reminder title and date are required.", true);
      return;
    }
    updateUser(function (user) {
      user.reminders.push({
        id: window.FinanceStorage.createId("rem"),
        title: title,
        amount: amount,
        dueDate: dueDate,
        frequency: frequency,
        createdAt: new Date().toISOString()
      });
      return user;
    });
    dom.reminderForm.reset();
    dom.reminderDate.value = toDateInputValue(new Date());
    setAppMessage("Reminder added.", false);
    renderAll();
  }

  function handleRemindersListClick(event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    var action = button.getAttribute("data-action");
    var reminderId = button.getAttribute("data-id");
    if (!reminderId) {
      return;
    }

    if (action === "remove-reminder") {
      updateUser(function (user) {
        user.reminders = window.FinanceStorage.removeItemById(user.reminders, reminderId);
        return user;
      });
      setAppMessage("Reminder removed.", false);
      renderAll();
      return;
    }

    if (action === "mark-reminder-paid") {
      updateUser(function (user) {
        var reminder = user.reminders.find(function (item) {
          return item.id === reminderId;
        });
        if (!reminder) {
          return user;
        }
        if (reminder.frequency === "monthly") {
          reminder.dueDate = shiftDate(reminder.dueDate, "monthly");
          reminder.updatedAt = new Date().toISOString();
        } else {
          user.reminders = window.FinanceStorage.removeItemById(user.reminders, reminderId);
        }
        return user;
      });
      setAppMessage("Reminder updated.", false);
      renderAll();
    }
  }

  function handleRecurringListClick(event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    var action = button.getAttribute("data-action");
    var ruleId = button.getAttribute("data-id");
    if (!ruleId) {
      return;
    }
    if (action === "toggle-recurring") {
      updateUser(function (user) {
        var rule = user.recurringRules.find(function (item) {
          return item.id === ruleId;
        });
        if (rule) {
          rule.active = !rule.active;
          rule.updatedAt = new Date().toISOString();
        }
        return user;
      });
      renderAll();
      return;
    }
    if (action === "remove-recurring") {
      updateUser(function (user) {
        user.recurringRules = window.FinanceStorage.removeItemById(user.recurringRules, ruleId);
        return user;
      });
      renderAll();
    }
  }

  function processDueRecurringTransactions() {
    if (!state.user || !Array.isArray(state.user.recurringRules)) {
      return;
    }
    var today = toDateInputValue(new Date());
    var changed = false;

    var nextUser = updateUser(function (user) {
      var transactions = Array.isArray(user.transactions) ? user.transactions : [];
      user.recurringRules.forEach(function (rule) {
        if (!rule.active || !rule.nextDate) {
          return;
        }
        var safetyCounter = 0;
        while (rule.nextDate <= today && safetyCounter < 120) {
          var alreadyCreated = transactions.some(function (item) {
            return item.recurringRuleId === rule.id && item.date === rule.nextDate;
          });
          if (!alreadyCreated) {
            transactions.push({
              id: window.FinanceStorage.createId("txn"),
              recurringRuleId: rule.id,
              type: rule.type,
              amount: toAmount(rule.amount),
              date: rule.nextDate,
              categoryId: rule.categoryId,
              notes: rule.notes || rule.title || "Recurring Transaction",
              tags: Array.isArray(rule.tags) ? rule.tags : [],
              accountId: rule.accountId || getDefaultAccountId(),
              createdAt: new Date().toISOString()
            });
            changed = true;
          }
          rule.nextDate = shiftDate(rule.nextDate, rule.frequency);
          rule.updatedAt = new Date().toISOString();
          safetyCounter += 1;
          changed = true;
        }
      });
      user.transactions = transactions;
      return user;
    }, false);

    if (changed) {
      state.user = nextUser;
    }
  }

  function renderStats() {
    var transactions = getTransactionsSorted(state.user.transactions);
    var currentMonth = getCurrentMonthKey();
    var today = toDateInputValue(new Date());
    var startOfWeek = getWeekStart(today);

    var summary = transactions.reduce(function (acc, transaction) {
      var amount = toAmount(transaction.amount);
      if (transaction.type === "income") {
        acc.totalIncome += amount;
      } else {
        acc.totalExpense += amount;
      }
      if (transaction.date.slice(0, 7) === currentMonth) {
        if (transaction.type === "income") {
          acc.monthIncome += amount;
        } else {
          acc.monthExpense += amount;
        }
      }
      if (transaction.type === "expense") {
        if (transaction.date === today) {
          acc.todayExpense += amount;
        }
        if (transaction.date >= startOfWeek && transaction.date <= today) {
          acc.weekExpense += amount;
        }
        if (transaction.date.slice(0, 7) === currentMonth) {
          acc.monthExpenseTotal += amount;
        }
      }
      return acc;
    }, {
      totalIncome: 0,
      totalExpense: 0,
      monthIncome: 0,
      monthExpense: 0,
      todayExpense: 0,
      weekExpense: 0,
      monthExpenseTotal: 0
    });

    var savingsRate = summary.monthIncome > 0 ? ((summary.monthIncome - summary.monthExpense) / summary.monthIncome) * 100 : 0;
    var balance = summary.totalIncome - summary.totalExpense;
    var netWorth = computeNetWorth();

    dom.totalBalance.textContent = formatMoney(balance);
    dom.netWorth.textContent = formatMoney(netWorth);
    dom.monthlyIncome.textContent = formatMoney(summary.monthIncome);
    dom.monthlyExpense.textContent = formatMoney(summary.monthExpense);
    dom.todaySpend.textContent = formatMoney(summary.todayExpense);
    dom.weekSpend.textContent = formatMoney(summary.weekExpense);
    dom.monthSpend.textContent = formatMoney(summary.monthExpenseTotal);
    dom.savingsRate.textContent = savingsRate.toFixed(1) + "%";
  }

  function renderTransactionsTable() {
    var transactions = applyTransactionFilters(getTransactionsSorted(state.user.transactions));
    var countLabel = transactions.length + " records";
    if (dom.transactionCount) {
      dom.transactionCount.textContent = countLabel;
    }
    if (dom.transactionsModalCount) {
      dom.transactionsModalCount.textContent = countLabel;
    }
    if (!dom.transactionsBody) {
      return;
    }
    if (transactions.length === 0) {
      dom.transactionsBody.innerHTML = "<tr><td colspan='8'>No transactions found.</td></tr>";
      return;
    }
    dom.transactionsBody.innerHTML = transactions.map(function (transaction) {
      var typeClass = transaction.type === "income" ? "text-income" : "text-expense";
      var typeLabel = capitalize(transaction.type);
      var tags = (transaction.tags || []).length ? escapeHtml((transaction.tags || []).join(", ")) : "-";
      return [
        "<tr>",
        "<td>", escapeHtml(formatDate(transaction.date)), "</td>",
        "<td class='", typeClass, "'>", typeLabel, "</td>",
        "<td>", escapeHtml(formatMoney(transaction.amount)), "</td>",
        "<td>", escapeHtml(getCategoryName(transaction.categoryId)), "</td>",
        "<td>", escapeHtml(getAccountName(transaction.accountId)), "</td>",
        "<td>", tags, "</td>",
        "<td>", escapeHtml(transaction.notes || "-"), "</td>",
        "<td><div class='action-row'>",
        "<button class='btn btn-ghost' type='button' data-action='view-transaction' data-id='", transaction.id, "'>View</button>",
        "<button class='btn btn-ghost' type='button' data-action='edit-transaction' data-id='", transaction.id, "'>Edit</button>",
        "<button class='btn btn-danger' type='button' data-action='delete-transaction' data-id='", transaction.id, "'>Delete</button>",
        "</div></td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderCategories() {
    var categories = (state.user.categories || []).slice().sort(function (a, b) {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });
    if (categories.length === 0) {
      dom.categoriesList.innerHTML = "<p>No categories available.</p>";
      return;
    }
    dom.categoriesList.innerHTML = categories.map(function (category) {
      var deleteButton = category.system ? "" : "<button type='button' data-action='remove-category' data-id='" + category.id + "' title='Remove category'>x</button>";
      return "<span class='pill'>" + escapeHtml(category.name) + " <small>(" + escapeHtml(category.type) + ")</small>" + deleteButton + "</span>";
    }).join("");
  }

  function renderAccounts() {
    var accounts = state.user.accounts || [];
    var accountBalanceMap = computeAccountBalanceMap();
    dom.accountsList.innerHTML = accounts.map(function (account) {
      var balance = accountBalanceMap[account.id] || 0;
      return [
        "<div class='list-card'>",
        "<div class='list-card-head'>",
        "<strong>", escapeHtml(account.name), "</strong>",
        "<button class='btn btn-danger' type='button' data-action='remove-account' data-id='", account.id, "'>Remove</button>",
        "</div>",
        "<span>Type: ", escapeHtml(account.type), "</span>",
        "<span>Balance: ", escapeHtml(formatMoney(balance)), "</span>",
        "</div>"
      ].join("");
    }).join("");
  }

  function renderBudgets() {
    var currentMonth = getCurrentMonthKey();
    var budgets = (state.user.budgets || []).filter(function (budget) {
      return budget.month === currentMonth;
    });
    var expenseTransactions = (state.user.transactions || []).filter(function (tx) {
      return tx.type === "expense" && tx.date.slice(0, 7) === currentMonth;
    });
    if (budgets.length === 0) {
      dom.budgetsList.innerHTML = "<p>No budgets for " + currentMonth + ". Add one above.</p>";
      return;
    }
    dom.budgetsList.innerHTML = budgets.map(function (budget) {
      var spent = expenseTransactions.reduce(function (total, transaction) {
        return transaction.categoryId === budget.categoryId ? total + toAmount(transaction.amount) : total;
      }, 0);
      var percent = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
      var clampedPercent = Math.min(percent, 100);
      var barClass = percent >= 100 ? "danger" : percent >= 80 ? "warn" : "";
      var helperText = percent >= 100 ? "Budget exceeded." : percent >= 80 ? "Almost at limit." : "In safe range.";
      return [
        "<div class='list-card'>",
        "<div class='list-card-head'>",
        "<strong>", escapeHtml(getCategoryName(budget.categoryId)), "</strong>",
        "<button class='btn btn-danger' type='button' data-action='remove-budget' data-id='", budget.id, "'>Remove</button>",
        "</div>",
        "<span>", escapeHtml(formatMoney(spent)), " / ", escapeHtml(formatMoney(budget.limit)), " used</span>",
        "<div class='progress-wrap'><div class='progress-bar ", barClass, "' style='width:", clampedPercent.toFixed(1), "%'></div></div>",
        "<span>", helperText, "</span>",
        "</div>"
      ].join("");
    }).join("");
  }

  function renderGoals() {
    var goals = state.user.goals || [];
    if (goals.length === 0) {
      dom.goalsList.innerHTML = "<p>No goals yet. Create your first savings goal.</p>";
      return;
    }
    dom.goalsList.innerHTML = goals.map(function (goal) {
      var saved = toAmount(goal.saved);
      var target = toAmount(goal.target);
      var percent = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
      return [
        "<div class='list-card'>",
        "<div class='list-card-head'>",
        "<strong>", escapeHtml(goal.name), "</strong>",
        "<div class='action-row'>",
        "<button class='btn btn-primary' type='button' data-action='add-goal-funds' data-id='", goal.id, "'>Add Funds</button>",
        "<button class='btn btn-danger' type='button' data-action='remove-goal' data-id='", goal.id, "'>Remove</button>",
        "</div>",
        "</div>",
        "<span>", escapeHtml(formatMoney(saved)), " / ", escapeHtml(formatMoney(target)), "</span>",
        goal.deadline ? "<span>Deadline: " + escapeHtml(formatDate(goal.deadline)) + "</span>" : "",
        "<div class='progress-wrap'><div class='progress-bar' style='width:", percent.toFixed(1), "%'></div></div>",
        "</div>"
      ].join("");
    }).join("");
  }

  function renderReminders() {
    var reminders = (state.user.reminders || []).slice().sort(function (a, b) {
      return a.dueDate.localeCompare(b.dueDate);
    });
    if (reminders.length === 0) {
      dom.remindersList.innerHTML = "<p>No reminders added.</p>";
      return;
    }
    var today = toDateInputValue(new Date());
    var soonDate = shiftDate(today, "weekly");
    dom.remindersList.innerHTML = reminders.map(function (reminder) {
      var isOverdue = reminder.dueDate < today;
      var dueSoon = reminder.dueDate >= today && reminder.dueDate <= soonDate;
      var statusClass = isOverdue ? "alert-danger" : dueSoon ? "alert-warn" : "alert-info";
      var statusText = isOverdue ? "Overdue" : dueSoon ? "Due soon" : "Planned";
      return [
        "<div class='list-card'>",
        "<div class='list-card-head'>",
        "<strong>", escapeHtml(reminder.title), "</strong>",
        "<div class='action-row'>",
        "<button class='btn btn-primary' type='button' data-action='mark-reminder-paid' data-id='", reminder.id, "'>Mark Paid</button>",
        "<button class='btn btn-danger' type='button' data-action='remove-reminder' data-id='", reminder.id, "'>Remove</button>",
        "</div>",
        "</div>",
        "<span>Due: ", escapeHtml(formatDate(reminder.dueDate)), " (", statusText, ")</span>",
        reminder.amount > 0 ? "<span>Amount: " + escapeHtml(formatMoney(reminder.amount)) + "</span>" : "",
        "<span class='alert " + statusClass + "'>Frequency: " + escapeHtml(reminder.frequency || "none") + "</span>",
        "</div>"
      ].join("");
    }).join("");
  }

  function renderRecurringRules() {
    var rules = state.user.recurringRules || [];
    if (rules.length === 0) {
      dom.recurringList.innerHTML = "<p>No recurring rules yet. Enable recurring while adding a transaction.</p>";
      return;
    }
    dom.recurringList.innerHTML = rules.map(function (rule) {
      return [
        "<div class='list-card'>",
        "<div class='list-card-head'>",
        "<strong>", escapeHtml(rule.title || getCategoryName(rule.categoryId)), "</strong>",
        "<div class='action-row'>",
        "<button class='btn btn-ghost' type='button' data-action='toggle-recurring' data-id='", rule.id, "'>", rule.active ? "Pause" : "Resume", "</button>",
        "<button class='btn btn-danger' type='button' data-action='remove-recurring' data-id='", rule.id, "'>Delete</button>",
        "</div>",
        "</div>",
        "<span>", escapeHtml(capitalize(rule.type)), " • ", escapeHtml(formatMoney(rule.amount)), "</span>",
        "<span>Category: ", escapeHtml(getCategoryName(rule.categoryId)), "</span>",
        "<span>Frequency: ", escapeHtml(rule.frequency), " • Next date: ", escapeHtml(formatDate(rule.nextDate)), "</span>",
        rule.active ? "<span class='alert alert-info'>Automation active.</span>" : "<span class='alert alert-warn'>Automation paused.</span>",
        "</div>"
      ].join("");
    }).join("");
  }

  function renderInsights() {
    var insights = generateInsights();
    if (insights.length === 0) {
      dom.insightsList.innerHTML = "<p>No insights yet. Add a few transactions to unlock suggestions.</p>";
      return;
    }
    dom.insightsList.innerHTML = insights.map(function (insight) {
      var className = insight.level === "danger" ? "alert-danger" : insight.level === "warn" ? "alert-warn" : "alert-info";
      return "<div class='alert " + className + "'>" + escapeHtml(insight.message) + "</div>";
    }).join("");
  }

  function generateInsights() {
    var insights = [];
    var month = getCurrentMonthKey();
    var transactions = state.user.transactions || [];
    var expensesThisMonth = transactions.filter(function (tx) {
      return tx.type === "expense" && tx.date.slice(0, 7) === month;
    });
    var incomeThisMonth = transactions.filter(function (tx) {
      return tx.type === "income" && tx.date.slice(0, 7) === month;
    });
    var totalExpense = expensesThisMonth.reduce(function (total, transaction) {
      return total + toAmount(transaction.amount);
    }, 0);
    var totalIncome = incomeThisMonth.reduce(function (total, transaction) {
      return total + toAmount(transaction.amount);
    }, 0);

    if (totalExpense > totalIncome && totalIncome > 0) {
      insights.push({ level: "danger", message: "You are spending more than you earn this month. Consider reducing discretionary expenses." });
    }
    if (totalIncome > 0) {
      var savingsRate = ((totalIncome - totalExpense) / totalIncome) * 100;
      if (savingsRate < 20) {
        insights.push({ level: "warn", message: "Savings rate is below 20%. Try setting tighter category budgets." });
      } else {
        insights.push({ level: "info", message: "Savings rate is " + savingsRate.toFixed(1) + "%. Great momentum." });
      }
    }

    var categoryTotals = aggregateExpenseByCategory(expensesThisMonth);
    var foodCategory = findCategoryByName("Food", "expense");
    var subscriptionCategory = findCategoryByName("Subscriptions", "expense");
    if (foodCategory) {
      var foodSpend = categoryTotals[foodCategory.id] || 0;
      if (totalExpense > 0 && foodSpend / totalExpense > 0.3) {
        insights.push({ level: "warn", message: "Food spend is above 30% of monthly expenses. Meal planning could reduce this." });
      }
    }
    if (subscriptionCategory) {
      var subscriptionSpend = categoryTotals[subscriptionCategory.id] || 0;
      if (subscriptionSpend > 0 && subscriptionSpend / Math.max(totalExpense, 1) > 0.12) {
        insights.push({ level: "warn", message: "Subscriptions are taking a significant share of spend. Review unused plans." });
      }
    }

    getCurrentMonthBudgetAlerts().forEach(function (alert) {
      insights.push(alert);
    });

    var nextSevenDate = shiftDate(toDateInputValue(new Date()), "weekly");
    var dueSoonCount = (state.user.reminders || []).filter(function (reminder) {
      return reminder.dueDate >= toDateInputValue(new Date()) && reminder.dueDate <= nextSevenDate;
    }).length;
    if (dueSoonCount > 0) {
      insights.push({ level: "info", message: dueSoonCount + " reminder(s) due in the next 7 days." });
    }

    var trendMessage = getSpendingTrendMessage();
    if (trendMessage) {
      insights.push(trendMessage);
    }
    return insights.slice(0, 8);
  }

  function renderCharts() {
    var allTransactions = applyTransactionFilters(getTransactionsSorted(state.user.transactions));
    var month = getCurrentMonthKey();
    var monthExpenses = allTransactions.filter(function (transaction) {
      return transaction.type === "expense" && transaction.date.slice(0, 7) === month;
    });

    var categoryTotalsMap = aggregateExpenseByCategory(monthExpenses);
    var pieLabels = Object.keys(categoryTotalsMap).map(function (categoryId) {
      return getCategoryName(categoryId);
    });
    var pieValues = Object.keys(categoryTotalsMap).map(function (categoryId) {
      return toAmount(categoryTotalsMap[categoryId]);
    });
    if (pieLabels.length === 0) {
      pieLabels = ["No Data"];
      pieValues = [1];
    }
    window.ChartService.renderPie({ labels: pieLabels, values: pieValues });
    window.ChartService.renderMonthlyBar(buildMonthlyTrendData(allTransactions, 6));
    window.ChartService.renderBalanceLine(buildRunningBalanceData(allTransactions));
    window.ChartService.renderDailyPattern(buildDailySpendData(allTransactions, 14));
  }

  function buildMonthlyTrendData(transactions, monthsBackCount) {
    var monthKeys = getRecentMonthKeys(monthsBackCount - 1);
    var labels = [];
    var incomeValues = [];
    var expenseValues = [];
    monthKeys.forEach(function (monthKey) {
      labels.push(formatMonthLabel(monthKey));
      var income = transactions.reduce(function (total, transaction) {
        return transaction.type === "income" && transaction.date.slice(0, 7) === monthKey ? total + toAmount(transaction.amount) : total;
      }, 0);
      var expense = transactions.reduce(function (total, transaction) {
        return transaction.type === "expense" && transaction.date.slice(0, 7) === monthKey ? total + toAmount(transaction.amount) : total;
      }, 0);
      incomeValues.push(income);
      expenseValues.push(expense);
    });
    return { labels: labels, incomeValues: incomeValues, expenseValues: expenseValues };
  }

  function buildRunningBalanceData(transactions) {
    var sorted = transactions.slice().sort(function (a, b) {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return String(a.id).localeCompare(String(b.id));
    });
    var labels = [];
    var values = [];
    var running = 0;
    sorted.forEach(function (transaction) {
      var amount = toAmount(transaction.amount);
      running += transaction.type === "income" ? amount : -amount;
      labels.push(formatDate(transaction.date));
      values.push(running);
    });
    if (labels.length === 0) {
      labels.push("No Data");
      values.push(0);
    }
    return { labels: labels, values: values };
  }

  function buildDailySpendData(transactions, dayCount) {
    var today = new Date();
    var labels = [];
    var values = [];
    var lookup = {};
    transactions.forEach(function (transaction) {
      if (transaction.type !== "expense") {
        return;
      }
      lookup[transaction.date] = (lookup[transaction.date] || 0) + toAmount(transaction.amount);
    });
    for (var offset = dayCount - 1; offset >= 0; offset -= 1) {
      var date = new Date(today);
      date.setDate(today.getDate() - offset);
      var key = toDateInputValue(date);
      labels.push(key.slice(5));
      values.push(lookup[key] || 0);
    }
    return { labels: labels, values: values };
  }

  async function exportTransactionsCsv() {
    var transactions = getTransactionsSorted(state.user.transactions);
    if (transactions.length === 0) {
      setAppMessage("No transactions available to export.", true);
      return;
    }

    var password = await promptForProtectedExportPassword("CSV");
    if (!password) {
      return;
    }

    try {
      var response = await fetchApi("/transactions/export/csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          password: password,
          transactions: buildExportTransactionPayload(transactions)
        })
      });

      if (!response.ok) {
        throw new Error(await getBackendError(response));
      }

      var fileBlob = await response.blob();
      downloadBlobFile("transactions_" + toDateInputValue(new Date()) + ".csv.enc", fileBlob);
      setAppMessage("Password-protected CSV exported (.csv.enc).", false);
    } catch (error) {
      setAppMessage("CSV export failed: " + error.message, true);
    }
  }

  function importTransactionsFromCsvFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    var reader = new FileReader();
    reader.onload = function (readerEvent) {
      try {
        var csvText = String(readerEvent.target.result || "");
        var rows = parseCsvRows(csvText);
        if (rows.length <= 1) {
          throw new Error("CSV file is empty or missing header row.");
        }

        var headers = rows[0].map(normalizeImportHeader);
        var importStats = {
          imported: 0,
          skipped: 0,
          errors: []
        };
        var dedupeMap = {};

        updateUser(function (user) {
          (user.transactions || []).forEach(function (transaction) {
            dedupeMap[buildTransactionSignature(
              transaction.date,
              transaction.type,
              transaction.amount,
              transaction.accountId,
              transaction.notes
            )] = true;
          });

          rows.slice(1).forEach(function (row, rowIndex) {
            var rowNumber = rowIndex + 2;
            if (isImportRowEmpty(row)) {
              importStats.skipped += 1;
              return;
            }
            try {
              var normalized = mapCsvRowToTransaction(row, headers, user);
              var signature = buildTransactionSignature(
                normalized.date,
                normalized.type,
                normalized.amount,
                normalized.accountId,
                normalized.notes
              );
              if (dedupeMap[signature]) {
                importStats.skipped += 1;
                return;
              }
              dedupeMap[signature] = true;
              user.transactions.push({
                id: window.FinanceStorage.createId("txn"),
                type: normalized.type,
                amount: normalized.amount,
                date: normalized.date,
                categoryId: normalized.categoryId,
                notes: normalized.notes,
                tags: normalized.tags,
                accountId: normalized.accountId,
                createdAt: new Date().toISOString()
              });
              importStats.imported += 1;
            } catch (rowError) {
              importStats.skipped += 1;
              if (importStats.errors.length < 3) {
                importStats.errors.push("Row " + rowNumber + ": " + rowError.message);
              }
            }
          });

          return user;
        }, false);

        renderAll();

        var message = importStats.imported + " transaction(s) imported.";
        if (importStats.skipped > 0) {
          message += " " + importStats.skipped + " row(s) skipped.";
        }
        if (importStats.errors.length > 0) {
          message += " " + importStats.errors.join(" ");
        }
        setAppMessage(message, importStats.imported === 0);
      } catch (error) {
        setAppMessage("CSV import failed: " + error.message, true);
      } finally {
        dom.importTransactionsInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function exportTransactionsPdf() {
    var sortedTransactions = getTransactionsSorted(state.user.transactions);
    var hasActiveFilters = hasActiveTransactionFilters();
    var transactions = hasActiveFilters ? applyTransactionFilters(sortedTransactions) : sortedTransactions;
    if (transactions.length === 0) {
      setAppMessage(hasActiveFilters ? "No transactions match current filters for export." : "No transactions available to export.", true);
      return;
    }

    var password = await promptForProtectedExportPassword("PDF");
    if (!password) {
      return;
    }

    try {
      var generatedAt = new Date();
      var timeZone = getClientTimeZone() || "Asia/Kolkata";
      var exportMeta = buildPdfExportMeta(transactions, hasActiveFilters, generatedAt);
      var response = await fetchApi("/transactions/export/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: "NexSpend Transactions Export",
          currency: state.user && state.user.settings ? state.user.settings.currency : "INR",
          generatedAt: generatedAt.toISOString(),
          timeZone: timeZone,
          exportMeta: exportMeta,
          password: password,
          transactions: buildExportTransactionPayload(transactions)
        })
      });

      if (!response.ok) {
        throw new Error(await getBackendError(response));
      }

      var pdfBlob = await response.blob();
      var fileStamp = buildPdfExportFileStamp(generatedAt);
      downloadBlobFile("transactions_export_" + fileStamp + ".pdf", pdfBlob);
      setAppMessage("Password-protected PDF exported.", false);
    } catch (error) {
      setAppMessage("PDF export failed: " + error.message, true);
    }
  }

  function buildExportTransactionPayload(transactions) {
    return transactions.map(function (transaction) {
      return {
        id: transaction.id,
        date: transaction.date,
        type: transaction.type,
        amount: toAmount(transaction.amount),
        category: getCategoryName(transaction.categoryId),
        account: getAccountName(transaction.accountId),
        tags: (transaction.tags || []).join(", "),
        notes: transaction.notes || ""
      };
    });
  }

  function hasActiveTransactionFilters() {
    var filters = state.filters || {};
    return Boolean(
      filters.keyword ||
      filters.categoryId ||
      filters.type ||
      filters.minAmount ||
      filters.maxAmount ||
      filters.fromDate ||
      filters.toDate ||
      filters.tag
    );
  }

  function buildPdfExportMeta(transactions, hasActiveFilters, generatedAt) {
    return {
      scopeLabel: hasActiveFilters ? "Filtered transactions" : "All transactions",
      dateRangeLabel: getPdfExportDateRangeLabel(transactions),
      appliedFilters: getActiveFilterSummaryLines(),
      fileTimestamp: buildPdfExportFileStamp(generatedAt)
    };
  }

  function getPdfExportDateRangeLabel(transactions) {
    if (state.filters && (state.filters.fromDate || state.filters.toDate)) {
      var fromLabel = state.filters.fromDate ? formatDate(state.filters.fromDate) : "Any start";
      var toLabel = state.filters.toDate ? formatDate(state.filters.toDate) : "Any end";
      return fromLabel + " to " + toLabel;
    }
    var bounds = getTransactionDateBounds(transactions);
    if (!bounds.from || !bounds.to) {
      return "Not specified";
    }
    return formatDate(bounds.from) + " to " + formatDate(bounds.to);
  }

  function getTransactionDateBounds(transactions) {
    var from = "";
    var to = "";
    (transactions || []).forEach(function (transaction) {
      var date = String(transaction && transaction.date ? transaction.date : "");
      if (!date) {
        return;
      }
      if (!from || date < from) {
        from = date;
      }
      if (!to || date > to) {
        to = date;
      }
    });
    return {
      from: from,
      to: to
    };
  }

  function getActiveFilterSummaryLines() {
    var filters = state.filters || {};
    var lines = [];
    if (filters.keyword) {
      lines.push("Keyword: " + filters.keyword);
    }
    if (filters.categoryId) {
      lines.push("Category: " + getCategoryName(filters.categoryId));
    }
    if (filters.type) {
      lines.push("Type: " + capitalize(filters.type));
    }
    if (filters.minAmount || filters.maxAmount) {
      var minText = filters.minAmount ? String(filters.minAmount) : "Any";
      var maxText = filters.maxAmount ? String(filters.maxAmount) : "Any";
      lines.push("Amount: " + minText + " to " + maxText);
    }
    if (filters.fromDate || filters.toDate) {
      var fromText = filters.fromDate ? formatDate(filters.fromDate) : "Any";
      var toText = filters.toDate ? formatDate(filters.toDate) : "Any";
      lines.push("Date filter: " + fromText + " to " + toText);
    }
    if (filters.tag) {
      lines.push("Tag: " + filters.tag);
    }
    if (lines.length === 0) {
      return ["None"];
    }
    return lines;
  }

  function buildPdfExportFileStamp(date) {
    var source = date instanceof Date ? date : new Date();
    var year = source.getFullYear();
    var month = String(source.getMonth() + 1).padStart(2, "0");
    var day = String(source.getDate()).padStart(2, "0");
    var hour = String(source.getHours()).padStart(2, "0");
    var minute = String(source.getMinutes()).padStart(2, "0");
    var second = String(source.getSeconds()).padStart(2, "0");
    return year + month + day + "_" + hour + minute + second;
  }

  async function promptForProtectedExportPassword(fileTypeLabel) {
    var password = await openProtectedPromptModal({
      title: "Protected " + fileTypeLabel + " Export",
      message: "Set a password for " + fileTypeLabel + " export (minimum 4 characters).",
      placeholder: "Enter password",
      confirmLabel: "Export",
      autocomplete: "new-password",
      validate: function (value) {
        if (!value) {
          return "Password is required for protected export.";
        }
        if (value.length < 4) {
          return "Password must be at least 4 characters.";
        }
        return "";
      }
    });
    if (!password) {
      setAppMessage("Export cancelled.", true);
      return "";
    }
    return password;
  }

  async function importTransactionsFromPdfFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      var payload = await requestPdfImportWithPasswordPrompt(file);
      var parsed = Array.isArray(payload.transactions) ? payload.transactions : [];
      if (parsed.length === 0) {
        setAppMessage("No transactions detected. For PhonePe, export full transaction history (with date/amount columns) or use CSV import.", true);
        return;
      }

      var importStats = {
        imported: 0,
        skipped: 0,
        errors: []
      };
      var dedupeMap = {};

      updateUser(function (user) {
        (user.transactions || []).forEach(function (transaction) {
          dedupeMap[buildTransactionSignature(
            transaction.date,
            transaction.type,
            transaction.amount,
            transaction.accountId,
            transaction.notes
          )] = true;
        });

        parsed.forEach(function (item, index) {
          try {
            var normalized = mapPdfItemToTransaction(item, user);
            var signature = buildTransactionSignature(
              normalized.date,
              normalized.type,
              normalized.amount,
              normalized.accountId,
              normalized.notes
            );
            if (dedupeMap[signature]) {
              importStats.skipped += 1;
              return;
            }
            dedupeMap[signature] = true;

            user.transactions.push({
              id: window.FinanceStorage.createId("txn"),
              type: normalized.type,
              amount: normalized.amount,
              date: normalized.date,
              categoryId: normalized.categoryId,
              notes: normalized.notes,
              tags: normalized.tags,
              accountId: normalized.accountId,
              createdAt: new Date().toISOString()
            });
            importStats.imported += 1;
          } catch (itemError) {
            importStats.skipped += 1;
            if (importStats.errors.length < 3) {
              importStats.errors.push("Line " + (index + 1) + ": " + itemError.message);
            }
          }
        });
        return user;
      }, false);

      renderAll();

      var message = importStats.imported + " transaction(s) imported from PDF.";
      if (importStats.skipped > 0) {
        message += " " + importStats.skipped + " row(s) skipped.";
      }
      if (importStats.errors.length > 0) {
        message += " " + importStats.errors.join(" ");
      }
      setAppMessage(message, importStats.imported === 0);
    } catch (error) {
      var rawMessage = String(error && error.message ? error.message : "");
      if (rawMessage.toLowerCase().indexOf("failed to fetch") !== -1 || rawMessage.toLowerCase().indexOf("reach backend api") !== -1) {
        setAppMessage("PDF import failed: Cannot reach backend API. Ensure backend is running (port 4000/4100) or set NEXSPEND_API_BASE.", true);
      } else {
        setAppMessage("PDF import failed: " + rawMessage, true);
      }
    } finally {
      dom.importPdfInput.value = "";
    }
  }

  async function requestPdfImportWithPasswordPrompt(file) {
    var responsePayload = null;
    try {
      responsePayload = await requestPdfImport(file, "");
      return responsePayload;
    } catch (firstError) {
      var code = firstError && firstError.code ? firstError.code : "";
      if (code !== "PDF_PASSWORD_REQUIRED" && code !== "PDF_PASSWORD_INVALID") {
        throw firstError;
      }
      var latestError = firstError;
      for (var attempt = 1; attempt <= 2; attempt += 1) {
        var promptMessage = latestError.code === "PDF_PASSWORD_INVALID"
          ? "Incorrect PDF password. Please enter the correct password."
          : "This PDF is password-protected. Enter PDF password.";
        var password = await openProtectedPromptModal({
          title: "PDF Password Required",
          message: promptMessage,
          placeholder: "Enter PDF password",
          confirmLabel: "Continue",
          autocomplete: "current-password",
          validate: function (value) {
            if (!value) {
              return "PDF password is required.";
            }
            return "";
          }
        });
        if (password == null) {
          throw new Error("Import cancelled. PDF password was not provided.");
        }
        var cleanPassword = String(password || "").trim();
        if (!cleanPassword) {
          latestError = new Error("Import cancelled. PDF password was empty.");
          latestError.code = "PDF_PASSWORD_REQUIRED";
          continue;
        }
        try {
          responsePayload = await requestPdfImport(file, cleanPassword);
          return responsePayload;
        } catch (retryError) {
          latestError = retryError;
          if (retryError.code !== "PDF_PASSWORD_INVALID" && retryError.code !== "PDF_PASSWORD_REQUIRED") {
            throw retryError;
          }
        }
      }
      throw latestError;
    }
  }

  async function requestPdfImport(file, password) {
    var formData = new FormData();
    formData.append("statement", file);
    if (password) {
      formData.append("password", password);
    }

    var response = await fetchApi("/transactions/import/pdf", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      var errorInfo = await getBackendErrorInfo(response);
      var backendError = new Error(errorInfo.message);
      backendError.code = errorInfo.code;
      throw backendError;
    }

    return response.json();
  }

  function mapPdfItemToTransaction(item, user) {
    var date = normalizeImportDate(item.date);
    if (!date) {
      throw new Error("date is missing or invalid.");
    }

    var amountValue = parseImportAmount(item.amount);
    if (!amountValue) {
      throw new Error("amount is missing or invalid.");
    }

    var type = normalizeImportType(item.type);
    if (!type) {
      type = amountValue < 0 ? "expense" : "income";
    }
    var amount = Math.abs(amountValue);
    var notes = String(item.notes || item.description || "").trim();
    var categoryName = String(item.category || "").trim();
    var accountName = String(item.account || item.accountName || "").trim();
    var tags = Array.isArray(item.tags)
      ? parseImportTags(item.tags.join(","))
      : parseImportTags(item.tags);

    return {
      type: type,
      amount: amount,
      date: date,
      categoryId: resolveImportCategoryId(user, type, categoryName, notes),
      accountId: resolveImportAccountId(user, accountName),
      tags: tags,
      notes: notes
    };
  }

  async function getBackendError(response) {
    var errorInfo = await getBackendErrorInfo(response);
    return errorInfo.message;
  }

  function getApiBaseCandidates() {
    var candidates = [RUNTIME_API_BASE, BACKEND_API_BASE];
    if (window.location && window.location.origin) {
      candidates.push(String(window.location.origin).replace(/\/+$/, "") + "/api");
    }
    if (window.location && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      candidates.push("http://localhost:4000/api");
      candidates.push("http://localhost:4100/api");
    }
    var unique = [];
    candidates.forEach(function (item) {
      var base = String(item || "").replace(/\/+$/, "");
      if (base && unique.indexOf(base) === -1) {
        unique.push(base);
      }
    });
    return unique;
  }

  async function fetchApi(path, options) {
    var endpointPath = String(path || "");
    var candidates = getApiBaseCandidates();
    var lastError = null;

    for (var index = 0; index < candidates.length; index += 1) {
      var base = candidates[index];
      try {
        var response = await fetch(base + endpointPath, options);
        RUNTIME_API_BASE = base;
        return response;
      } catch (error) {
        var message = String(error && error.message ? error.message : "");
        var isNetworkError = error && (error.name === "TypeError" || message.toLowerCase().indexOf("failed to fetch") !== -1);
        if (!isNetworkError) {
          throw error;
        }
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }
    throw new Error("Failed to reach backend API.");
  }

  async function getBackendErrorInfo(response) {
    try {
      var payload = await response.json();
      return {
        message: payload && payload.message ? payload.message : "Backend request failed.",
        code: payload && payload.code ? payload.code : ""
      };
    } catch (error) {
      return {
        message: "Backend request failed.",
        code: ""
      };
    }
  }

  async function exportSummaryPdf() {
    if (!state.user) {
      return;
    }

    var password = await promptForProtectedExportPassword("Summary PDF");
    if (!password) {
      return;
    }

    var month = getCurrentMonthKey();
    var income = getMonthIncome(month);
    var expense = getMonthExpense(month);
    var balance = income - expense;
    var insights = generateInsights().slice(0, 8).map(function (insight) {
      return insight && insight.message ? insight.message : String(insight || "");
    });

    try {
      var response = await fetchApi("/reports/export/summary/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          month: month,
          income: income,
          expense: expense,
          balance: balance,
          insights: insights,
          currency: state.user && state.user.settings ? state.user.settings.currency : "INR",
          password: password
        })
      });

      if (!response.ok) {
        throw new Error(await getBackendError(response));
      }

      var pdfBlob = await response.blob();
      downloadBlobFile("finance_summary_" + month + ".pdf", pdfBlob);
      setAppMessage("Password-protected summary PDF exported.", false);
    } catch (error) {
      setAppMessage("Summary PDF export failed: " + error.message, true);
    }
  }

  function backupUserData() {
    var payload = {
      exportedAt: new Date().toISOString(),
      app: "NexSpend",
      data: state.user
    };
    downloadFile("finance_backup_" + toDateInputValue(new Date()) + ".json", JSON.stringify(payload, null, 2), "application/json");
    setAppMessage("Backup downloaded.", false);
  }

  function restoreUserDataFromFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    var reader = new FileReader();
    reader.onload = function (readerEvent) {
      try {
        var parsed = JSON.parse(readerEvent.target.result);
        var imported = parsed.data ? parsed.data : parsed;
        if (!imported || typeof imported !== "object") {
          throw new Error("Invalid backup file.");
        }
        updateUser(function (user) {
          var merged = Object.assign({}, imported);
          merged.id = user.id;
          merged.email = user.email;
          merged.passwordHash = user.passwordHash;
          merged.settings = merged.settings || user.settings || {};
          merged.settings.pinHash = user.settings && user.settings.pinHash ? user.settings.pinHash : (merged.settings.pinHash || "");
          return merged;
        });
        setAppMessage("Backup restored.", false);
        renderAll();
      } catch (error) {
        setAppMessage("Restore failed: " + error.message, true);
      } finally {
        dom.restoreInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  function populateDropdowns() {
    populateTransactionCategorySelect(dom.transactionType.value || "expense", dom.transactionCategory.value || AUTO_CATEGORY_VALUE);
    populateFilterCategorySelect();
    populateBudgetCategorySelect();
    populateAccountsSelect(dom.transactionAccount.value || getDefaultAccountId());
  }

  function populateTransactionCategorySelect(type, selectedCategoryId) {
    var options = (state.user.categories || []).filter(function (category) {
      return category.type === type;
    });
    var html = ["<option value='" + AUTO_CATEGORY_VALUE + "'>Auto Detect</option>"].concat(options.map(function (category) {
      var isSelected = category.id === selectedCategoryId ? " selected" : "";
      return "<option value='" + category.id + "'" + isSelected + ">" + escapeHtml(category.name) + "</option>";
    }));
    dom.transactionCategory.innerHTML = html.join("");

    if (selectedCategoryId && selectedCategoryId !== AUTO_CATEGORY_VALUE && options.some(function (category) {
      return category.id === selectedCategoryId;
    })) {
      dom.transactionCategory.value = selectedCategoryId;
    } else {
      dom.transactionCategory.value = AUTO_CATEGORY_VALUE;
    }
  }

  function populateFilterCategorySelect() {
    var selected = dom.filterCategory.value || "";
    var html = ["<option value=''>All Categories</option>"].concat((state.user.categories || []).map(function (category) {
      return "<option value='" + category.id + "'>" + escapeHtml(category.name) + " (" + escapeHtml(category.type) + ")</option>";
    }));
    dom.filterCategory.innerHTML = html.join("");
    dom.filterCategory.value = selected;
  }

  function populateBudgetCategorySelect() {
    var selected = dom.budgetCategory.value || "";
    var categories = (state.user.categories || []).filter(function (category) {
      return category.type === "expense";
    });
    dom.budgetCategory.innerHTML = categories.map(function (category) {
      return "<option value='" + category.id + "'>" + escapeHtml(category.name) + "</option>";
    }).join("");
    if (selected && categories.some(function (category) {
      return category.id === selected;
    })) {
      dom.budgetCategory.value = selected;
    }
  }

  function populateAccountsSelect(selectedAccountId) {
    var accounts = state.user.accounts || [];
    dom.transactionAccount.innerHTML = accounts.map(function (account) {
      return "<option value='" + account.id + "'>" + escapeHtml(account.name) + " (" + escapeHtml(account.type) + ")</option>";
    }).join("");
    if (selectedAccountId && accounts.some(function (account) {
      return account.id === selectedAccountId;
    })) {
      dom.transactionAccount.value = selectedAccountId;
    } else if (accounts[0]) {
      dom.transactionAccount.value = accounts[0].id;
    }
  }

  function applyTransactionFilters(transactions) {
    var filters = state.filters;
    return transactions.filter(function (transaction) {
      if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
        return false;
      }
      if (filters.type && transaction.type !== filters.type) {
        return false;
      }
      if (filters.minAmount && toAmount(transaction.amount) < toAmount(filters.minAmount)) {
        return false;
      }
      if (filters.maxAmount && toAmount(transaction.amount) > toAmount(filters.maxAmount)) {
        return false;
      }
      if (filters.fromDate && transaction.date < filters.fromDate) {
        return false;
      }
      if (filters.toDate && transaction.date > filters.toDate) {
        return false;
      }
      if (filters.tag) {
        var tags = (transaction.tags || []).map(function (tag) {
          return tag.toLowerCase();
        });
        if (!tags.some(function (tag) {
          return tag.indexOf(filters.tag) !== -1;
        })) {
          return false;
        }
      }
      if (filters.keyword) {
        var categoryName = getCategoryName(transaction.categoryId).toLowerCase();
        var accountName = getAccountName(transaction.accountId).toLowerCase();
        var notes = String(transaction.notes || "").toLowerCase();
        var amountText = String(transaction.amount);
        var tagsText = (transaction.tags || []).join(" ").toLowerCase();
        var joined = [categoryName, accountName, notes, amountText, tagsText].join(" ");
        if (joined.indexOf(filters.keyword) === -1) {
          return false;
        }
      }
      return true;
    });
  }

  function getCurrentMonthBudgetAlerts() {
    var month = getCurrentMonthKey();
    var budgets = (state.user.budgets || []).filter(function (budget) {
      return budget.month === month;
    });
    var expenses = (state.user.transactions || []).filter(function (transaction) {
      return transaction.type === "expense" && transaction.date.slice(0, 7) === month;
    });
    return budgets.reduce(function (alerts, budget) {
      var spent = expenses.reduce(function (total, transaction) {
        return transaction.categoryId === budget.categoryId ? total + toAmount(transaction.amount) : total;
      }, 0);
      var usage = budget.limit > 0 ? spent / budget.limit : 0;
      if (usage >= 1) {
        alerts.push({ level: "danger", message: "Budget exceeded for " + getCategoryName(budget.categoryId) + "." });
      } else if (usage >= 0.8) {
        alerts.push({ level: "warn", message: "Budget for " + getCategoryName(budget.categoryId) + " is above 80%." });
      }
      return alerts;
    }, []);
  }

  function getSpendingTrendMessage() {
    var months = getRecentMonthKeys(2);
    var currentMonth = months[2];
    var previousMonth = months[1];
    var currentExpense = getMonthExpense(currentMonth);
    var previousExpense = getMonthExpense(previousMonth);
    if (previousExpense <= 0) {
      return null;
    }
    var change = ((currentExpense - previousExpense) / previousExpense) * 100;
    if (change > 20) {
      return { level: "warn", message: "Monthly expenses increased by " + change.toFixed(1) + "% compared to last month." };
    }
    if (change < -15) {
      return { level: "info", message: "Nice work. Expenses dropped by " + Math.abs(change).toFixed(1) + "% from last month." };
    }
    return null;
  }

  function updateUser(mutator, rerender) {
    var shouldRerender = rerender !== false;
    var updated = window.AuthService.updateCurrentUser(function (user) {
      return mutator(user) || user;
    });
    state.user = updated;
    if (shouldRerender) {
      renderAll();
    }
    return updated;
  }

  function setAuthMessage(message, isError) {
    dom.authMessage.textContent = message || "";
    dom.authMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function setAppMessage(message, isError) {
    dom.exportMessage.textContent = message || "";
    dom.exportMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function setTransactionDetectMessage(message, tone) {
    if (!dom.transactionDetectMessage) {
      return;
    }
    dom.transactionDetectMessage.textContent = message || "";
    dom.transactionDetectMessage.classList.remove("is-success", "is-warning", "is-error");
    if (tone === "success" || tone === "warning" || tone === "error") {
      dom.transactionDetectMessage.classList.add("is-" + tone);
    }
  }

  function toggleTheme() {
    var currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    dom.themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    if (state.user && window.ChartService) {
      renderCharts();
    }
    if (persist && state.user) {
      updateUser(function (user) {
        user.settings = user.settings || {};
        user.settings.theme = theme;
        return user;
      }, false);
    }
  }

  function inferCategoryId(type, notes) {
    return inferCategoryIdForUser(state.user, type, notes);
  }

  function inferCategoryIdForUser(user, type, notes) {
    var text = String(notes || "").toLowerCase();
    var keywordMap = categoryKeywords[type] || {};
    var categories = user && user.categories ? user.categories : [];
    var matchedCategoryName = "";
    Object.keys(keywordMap).some(function (categoryName) {
      var keywords = keywordMap[categoryName] || [];
      var matched = keywords.some(function (keyword) {
        return text.indexOf(keyword) !== -1;
      });
      if (matched) {
        matchedCategoryName = categoryName;
      }
      return matched;
    });
    if (matchedCategoryName) {
      var matchedCategory = categories.find(function (category) {
        return category.type === type && category.name.toLowerCase() === matchedCategoryName.toLowerCase();
      });
      if (matchedCategory) {
        return matchedCategory.id;
      }
    }
    var firstCategoryForType = categories.find(function (category) {
      return category.type === type;
    });
    return firstCategoryForType ? firstCategoryForType.id : "";
  }

  function getTransactionsSorted(list) {
    return (list || []).slice().sort(function (a, b) {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return String(b.id).localeCompare(String(a.id));
    });
  }

  function aggregateExpenseByCategory(expenseTransactions) {
    return expenseTransactions.reduce(function (map, transaction) {
      var categoryId = transaction.categoryId || "unknown";
      map[categoryId] = (map[categoryId] || 0) + toAmount(transaction.amount);
      return map;
    }, {});
  }

  function findCategoryByName(name, type) {
    return (state.user.categories || []).find(function (category) {
      return category.type === type && category.name.toLowerCase() === String(name).toLowerCase();
    });
  }

  function computeAccountBalanceMap() {
    var balances = {};
    (state.user.accounts || []).forEach(function (account) {
      balances[account.id] = toAmount(account.initialBalance);
    });
    (state.user.transactions || []).forEach(function (transaction) {
      var accountId = transaction.accountId || getDefaultAccountId();
      var amount = toAmount(transaction.amount);
      if (balances[accountId] == null) {
        balances[accountId] = 0;
      }
      balances[accountId] += transaction.type === "income" ? amount : -amount;
    });
    return balances;
  }

  function computeNetWorth() {
    var accountMap = computeAccountBalanceMap();
    return Object.keys(accountMap).reduce(function (total, accountId) {
      return total + toAmount(accountMap[accountId]);
    }, 0);
  }

  function getCategoryName(categoryId) {
    var category = (state.user.categories || []).find(function (item) {
      return item.id === categoryId;
    });
    return category ? category.name : "Uncategorized";
  }

  function getAccountName(accountId) {
    var account = (state.user.accounts || []).find(function (item) {
      return item.id === accountId;
    });
    return account ? account.name : "Unknown Account";
  }

  function getDefaultAccountId() {
    return state.user && state.user.accounts && state.user.accounts[0] ? state.user.accounts[0].id : "";
  }

  function detectTransactionFromRawText(text) {
    var source = String(text || "").replace(/\s+/g, " ").trim();
    if (!source) {
      throw new Error("Paste transaction text first.");
    }

    var bestAmountCandidate = getBestDetectionAmountCandidate(source);
    if (!bestAmountCandidate || !(bestAmountCandidate.amount > 0)) {
      throw new Error("Could not detect a valid amount in the pasted text.");
    }

    var dateToken = extractDateCandidateFromText(source);
    var detectedDate = normalizeImportDate(dateToken);
    var dateWasGuessed = false;
    if (!detectedDate) {
      detectedDate = toDateInputValue(new Date());
      dateWasGuessed = true;
    }

    var detectedType = inferDetectedTypeFromText(source, bestAmountCandidate.raw);
    var detectedNotes = cleanDetectedNotes(source, dateToken, bestAmountCandidate.raw);
    if (!detectedNotes) {
      detectedNotes = source.slice(0, 120);
    }

    var detectedAccountId = inferDetectedAccountIdFromText(source);
    var detectedCategoryId = inferCategoryIdForUser(state.user, detectedType, detectedNotes || source);
    var detectedTags = inferDetectedTags(source, detectedType, detectedNotes);

    return {
      amount: Math.abs(bestAmountCandidate.amount),
      type: detectedType,
      date: detectedDate,
      dateWasGuessed: dateWasGuessed,
      notes: detectedNotes,
      accountId: detectedAccountId,
      categoryId: detectedCategoryId,
      tags: detectedTags
    };
  }

  function findPotentialDuplicateTransaction(transactionLike) {
    if (!state.user || !Array.isArray(state.user.transactions)) {
      return null;
    }

    var signature = buildTransactionSignature(
      transactionLike.date,
      transactionLike.type,
      transactionLike.amount,
      transactionLike.accountId,
      transactionLike.notes
    );
    var accountId = transactionLike.accountId || getDefaultAccountId();
    var targetAmount = toAmount(transactionLike.amount);

    return state.user.transactions.find(function (transaction) {
      var txAccountId = transaction.accountId || getDefaultAccountId();
      if (buildTransactionSignature(transaction.date, transaction.type, transaction.amount, txAccountId, transaction.notes) === signature) {
        return true;
      }
      return (
        transaction.date === transactionLike.date &&
        transaction.type === transactionLike.type &&
        txAccountId === accountId &&
        Math.abs(toAmount(transaction.amount) - targetAmount) < 0.01
      );
    }) || null;
  }

  function getBestDetectionAmountCandidate(text) {
    var candidates = extractDetectionAmountCandidates(text);
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort(function (a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.index - a.index;
    });
    return candidates[0];
  }

  function extractDetectionAmountCandidates(text) {
    var source = String(text || "");
    var candidates = [];

    function pushCandidate(raw, index, strictMode) {
      var parsedAmount = parseImportAmount(raw);
      if (parsedAmount === 0) {
        return;
      }

      var contextStart = Math.max(0, index - 30);
      var contextEnd = Math.min(source.length, index + String(raw).length + 30);
      var context = source.slice(contextStart, contextEnd).toLowerCase();
      var score = strictMode ? 4 : 1;

      if (/(?:inr|rs\.?|\u20B9|\$|usd|eur|gbp)/i.test(raw)) {
        score += 6;
      }
      if (/\b(debit|debited|credit|credited|paid|received|txn|transaction|upi|spent|purchase|withdrawn|deposit)\b/.test(context)) {
        score += 4;
      }
      if (/\b(balance|avl|available|remaining|limit|outstanding)\b/.test(context)) {
        score -= 5;
      }

      candidates.push({
        raw: String(raw),
        amount: parsedAmount,
        index: index,
        score: score
      });
    }

    var strictPattern = /(?:\(|-)?(?:INR|Rs\.?|\u20B9|\$|USD|EUR|GBP)\s*\d[\d,]*(?:\.\d{1,2})?\)?|(?:\(|-)?\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?\)?|(?:\(|-)?\d+\.\d{1,2}\)?/gi;
    var strictMatch;
    while ((strictMatch = strictPattern.exec(source)) !== null) {
      pushCandidate(strictMatch[0], strictMatch.index, true);
    }

    if (candidates.length === 0) {
      var softPattern = /\b\d{2,7}\b/g;
      var softMatch;
      while ((softMatch = softPattern.exec(source)) !== null) {
        var contextStart = Math.max(0, softMatch.index - 20);
        var contextEnd = Math.min(source.length, softMatch.index + String(softMatch[0]).length + 20);
        var context = source.slice(contextStart, contextEnd).toLowerCase();
        if (!/\b(amount|debited|credited|paid|received|spent|txn|transaction|upi|transfer)\b/.test(context)) {
          continue;
        }
        pushCandidate(softMatch[0], softMatch.index, false);
      }
    }

    return candidates.filter(function (candidate) {
      return candidate.amount > 0;
    });
  }

  function inferDetectedTypeFromText(text, amountToken) {
    var lower = String(text || "").toLowerCase();
    if (/\b(credited|credit|received|salary|refund|cashback|interest|deposit|reversal|bonus)\b/.test(lower)) {
      return "income";
    }
    if (/\b(debited|debit|paid|spent|purchase|sent|withdraw|recharge|bill|charge|dr)\b/.test(lower)) {
      return "expense";
    }
    if (/^\(|^-/.test(String(amountToken || "").trim())) {
      return "expense";
    }
    return "expense";
  }

  function inferDetectedAccountIdFromText(text) {
    var lower = String(text || "").toLowerCase();
    var accounts = state.user && state.user.accounts ? state.user.accounts : [];

    var exact = accounts.find(function (account) {
      var accountName = String(account.name || "").trim().toLowerCase();
      return accountName && lower.indexOf(accountName) !== -1;
    });
    if (exact) {
      return exact.id;
    }

    if (/\b(upi|phonepe|gpay|google pay|paytm|bhim)\b/.test(lower)) {
      var upiAccount = accounts.find(function (account) {
        return account.type === "upi";
      });
      if (upiAccount) {
        return upiAccount.id;
      }
    }

    if (/\b(wallet|cash)\b/.test(lower)) {
      var walletAccount = accounts.find(function (account) {
        return account.type === "wallet";
      });
      if (walletAccount) {
        return walletAccount.id;
      }
    }

    if (/\b(card|bank|account|a\/c|acct)\b/.test(lower)) {
      var bankAccount = accounts.find(function (account) {
        return account.type === "bank";
      });
      if (bankAccount) {
        return bankAccount.id;
      }
    }

    return getDefaultAccountId();
  }

  function inferDetectedTags(text, type, notes) {
    var lower = (String(text || "") + " " + String(notes || "")).toLowerCase();
    var tags = [];

    function addTag(tag) {
      if (tags.indexOf(tag) === -1) {
        tags.push(tag);
      }
    }

    if (/\b(upi|phonepe|gpay|google pay|paytm|bhim)\b/.test(lower)) {
      addTag("upi");
    }
    if (/\b(card|credit card|debit card)\b/.test(lower)) {
      addTag("card");
    }
    if (/\b(wallet|cash)\b/.test(lower)) {
      addTag("wallet");
    }
    if (/\b(subscription|autopay|renewal)\b/.test(lower)) {
      addTag("subscription");
    }
    if (/\b(transfer|imps|neft|rtgs)\b/.test(lower)) {
      addTag("transfer");
    }
    if (/\b(refund|reversal)\b/.test(lower)) {
      addTag("refund");
    }
    if (type === "income" && /\b(salary|payroll)\b/.test(lower)) {
      addTag("salary");
    }

    return tags.slice(0, 4);
  }

  function cleanDetectedNotes(text, dateToken, amountToken) {
    var notes = String(text || "");
    if (dateToken) {
      notes = notes.replace(dateToken, " ");
    }
    if (amountToken) {
      notes = notes.replace(amountToken, " ");
    }

    notes = notes
      .replace(/\b(?:transaction(?: id)?|txn(?: id)?|utr(?: no)?|ref(?:erence)?(?: no)?|order(?: id)?)\b\s*[:#-]?\s*[\w/-]*/gi, " ")
      .replace(/\b(?:available balance|avl balance|closing balance|balance)\b\s*[:#-]?\s*[\w.,/-]*/gi, " ")
      .replace(/\b(?:a\/c|acct|account)\b\s*[:#-]?\s*[\w*-]*/gi, " ")
      .replace(/\b(?:inr|rs\.?|\u20B9)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (notes.length > 120) {
      notes = notes.slice(0, 120).trim();
    }

    return notes;
  }

  function extractDateCandidateFromText(text) {
    var source = String(text || "");
    if (!source) {
      return "";
    }

    var datePatterns = [
      /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/,
      /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,
      /\b\d{1,2}(?:st|nd|rd|th)?[\s\-\/]+[A-Za-z]{3,9}[\s,\-\/]+\d{2,4}\b/i,
      /\b[A-Za-z]{3,9}[\s\-\/]+\d{1,2}(?:st|nd|rd|th)?[,]?[\s\-\/]+\d{2,4}\b/i
    ];

    for (var index = 0; index < datePatterns.length; index += 1) {
      var match = source.match(datePatterns[index]);
      if (match) {
        return match[0];
      }
    }

    return "";
  }

  function getMonthIncome(monthKey) {
    return (state.user.transactions || []).reduce(function (total, transaction) {
      return transaction.type === "income" && transaction.date.slice(0, 7) === monthKey ? total + toAmount(transaction.amount) : total;
    }, 0);
  }

  function getMonthExpense(monthKey) {
    return (state.user.transactions || []).reduce(function (total, transaction) {
      return transaction.type === "expense" && transaction.date.slice(0, 7) === monthKey ? total + toAmount(transaction.amount) : total;
    }, 0);
  }

  function getRecentMonthKeys(offsetCount) {
    var now = new Date();
    var months = [];
    for (var index = offsetCount; index >= 0; index -= 1) {
      var date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      months.push(date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"));
    }
    return months;
  }

  function getCurrentMonthKey() {
    var today = new Date();
    return today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
  }

  function getWeekStart(dateString) {
    var date = new Date(dateString + "T00:00:00");
    var day = date.getDay();
    var shift = day === 0 ? 6 : day - 1;
    date.setDate(date.getDate() - shift);
    return toDateInputValue(date);
  }

  function shiftDate(dateString, frequency) {
    var date = new Date(dateString + "T00:00:00");
    if (frequency === "weekly") {
      date.setDate(date.getDate() + 7);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return toDateInputValue(date);
  }

  function parseCsvRows(text) {
    var csvText = String(text || "").replace(/^\uFEFF/, "");
    var rows = [];
    var row = [];
    var value = "";
    var inQuotes = false;

    for (var index = 0; index < csvText.length; index += 1) {
      var char = csvText.charAt(index);

      if (char === '"') {
        if (inQuotes && csvText.charAt(index + 1) === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(value);
        value = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && csvText.charAt(index + 1) === "\n") {
          index += 1;
        }
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
        continue;
      }

      value += char;
    }

    if (value.length > 0 || row.length > 0) {
      row.push(value);
      rows.push(row);
    }

    while (rows.length > 0 && isImportRowEmpty(rows[rows.length - 1])) {
      rows.pop();
    }

    return rows;
  }

  function normalizeImportHeader(header) {
    return String(header || "")
      .trim()
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function isImportRowEmpty(row) {
    return (row || []).every(function (cell) {
      return String(cell || "").trim() === "";
    });
  }

  function getCsvImportValue(row, headers, aliases) {
    var matchedHeader = aliases.find(function (alias) {
      return headers.indexOf(alias) !== -1;
    });
    if (!matchedHeader) {
      return "";
    }
    var cellIndex = headers.indexOf(matchedHeader);
    return String(row[cellIndex] == null ? "" : row[cellIndex]).trim();
  }

  function mapCsvRowToTransaction(row, headers, user) {
    var dateText = getCsvImportValue(row, headers, [
      "date",
      "transaction_date",
      "txn_date",
      "posted_date",
      "value_date"
    ]);
    if (!dateText) {
      throw new Error("date is missing.");
    }

    var date = normalizeImportDate(dateText);
    if (!date) {
      throw new Error("date format is not supported.");
    }

    var explicitType = normalizeImportType(getCsvImportValue(row, headers, [
      "type",
      "transaction_type",
      "txn_type",
      "dr_cr",
      "credit_debit",
      "entry_type"
    ]));

    var amountText = getCsvImportValue(row, headers, [
      "amount",
      "transaction_amount",
      "amt",
      "value"
    ]);
    var debitText = getCsvImportValue(row, headers, [
      "debit",
      "debit_amount",
      "withdrawal",
      "withdrawn",
      "spent"
    ]);
    var creditText = getCsvImportValue(row, headers, [
      "credit",
      "credit_amount",
      "deposit",
      "received",
      "income"
    ]);

    var rawAmount = parseImportAmount(amountText);
    var debitAmount = parseImportAmount(debitText);
    var creditAmount = parseImportAmount(creditText);
    var amount = 0;
    var type = explicitType;

    if (debitAmount > 0 || creditAmount > 0) {
      if (debitAmount > 0 && creditAmount > 0) {
        throw new Error("both debit and credit are present.");
      }
      if (debitAmount > 0) {
        amount = debitAmount;
        type = "expense";
      } else {
        amount = creditAmount;
        type = "income";
      }
    } else {
      if (!amountText || rawAmount === 0) {
        throw new Error("amount is missing or invalid.");
      }
      amount = Math.abs(rawAmount);
      if (!type) {
        type = rawAmount < 0 ? "expense" : "income";
      }
    }

    if (explicitType) {
      type = explicitType;
    }
    if (!type) {
      throw new Error("transaction type is missing.");
    }
    if (amount <= 0) {
      throw new Error("amount must be greater than 0.");
    }

    var notes = getCsvImportValue(row, headers, [
      "notes",
      "note",
      "description",
      "narration",
      "details",
      "remark",
      "remarks",
      "merchant"
    ]);
    var categoryName = getCsvImportValue(row, headers, [
      "category",
      "category_name"
    ]);
    var accountName = getCsvImportValue(row, headers, [
      "account",
      "account_name",
      "bank_account",
      "wallet"
    ]);
    var tags = parseImportTags(getCsvImportValue(row, headers, [
      "tags",
      "tag",
      "labels"
    ]));

    return {
      type: type,
      amount: amount,
      date: date,
      categoryId: resolveImportCategoryId(user, type, categoryName, notes),
      accountId: resolveImportAccountId(user, accountName),
      tags: tags,
      notes: notes
    };
  }

  function parseImportAmount(text) {
    var raw = String(text || "").trim();
    if (!raw) {
      return 0;
    }

    var negativeFromBrackets = /^\(.*\)$/.test(raw);
    var normalized = raw.replace(/[,\s]/g, "").replace(/[^\d.\-]/g, "");
    if (!normalized || normalized === "." || normalized === "-" || normalized === "-.") {
      return 0;
    }

    var parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    if (negativeFromBrackets) {
      return -Math.abs(parsed);
    }
    return parsed;
  }

  function normalizeImportType(typeText) {
    var normalized = String(typeText || "").trim().toLowerCase();
    if (!normalized) {
      return "";
    }
    if (
      normalized === "income" ||
      normalized === "credit" ||
      normalized === "cr" ||
      normalized === "deposit" ||
      normalized === "inflow" ||
      normalized === "received"
    ) {
      return "income";
    }
    if (
      normalized === "expense" ||
      normalized === "debit" ||
      normalized === "dr" ||
      normalized === "withdrawal" ||
      normalized === "outflow" ||
      normalized === "spent"
    ) {
      return "expense";
    }
    return "";
  }

  function resolveImportAccountId(user, accountName) {
    var accounts = user.accounts || [];
    var cleanName = String(accountName || "").trim();

    if (!cleanName) {
      if (accounts[0]) {
        return accounts[0].id;
      }
      var defaultAccount = {
        id: window.FinanceStorage.createId("acct"),
        name: "Imported Account",
        type: "bank",
        initialBalance: 0
      };
      user.accounts.push(defaultAccount);
      return defaultAccount.id;
    }

    var existing = accounts.find(function (account) {
      return account.name.toLowerCase() === cleanName.toLowerCase();
    });
    if (existing) {
      return existing.id;
    }

    var type = "bank";
    var normalizedName = cleanName.toLowerCase();
    if (normalizedName.indexOf("upi") !== -1) {
      type = "upi";
    } else if (normalizedName.indexOf("wallet") !== -1 || normalizedName.indexOf("cash") !== -1) {
      type = "wallet";
    }

    var nextAccount = {
      id: window.FinanceStorage.createId("acct"),
      name: cleanName,
      type: type,
      initialBalance: 0
    };
    user.accounts.push(nextAccount);
    return nextAccount.id;
  }

  function resolveImportCategoryId(user, type, categoryName, notes) {
    var categories = user.categories || [];
    var cleanName = String(categoryName || "").trim();

    if (cleanName) {
      var existing = categories.find(function (category) {
        return category.type === type && category.name.toLowerCase() === cleanName.toLowerCase();
      });
      if (existing) {
        return existing.id;
      }
      var created = {
        id: window.FinanceStorage.createId("cat"),
        name: cleanName,
        type: type,
        system: false
      };
      user.categories.push(created);
      return created.id;
    }

    var inferred = inferCategoryIdForUser(user, type, notes);
    if (inferred) {
      return inferred;
    }

    var fallback = {
      id: window.FinanceStorage.createId("cat"),
      name: type === "income" ? "Imported Income" : "Imported Expense",
      type: type,
      system: false
    };
    user.categories.push(fallback);
    return fallback.id;
  }

  function parseImportTags(text) {
    var tagText = String(text || "").trim();
    if (!tagText) {
      return [];
    }
    return parseTags(tagText.replace(/[|;]/g, ","));
  }

  function getMonthIndexByName(monthName) {
    return MONTH_INDEX_BY_NAME[String(monthName || "").trim().toLowerCase()] || 0;
  }

  function normalizeImportDate(value) {
    var text = String(value || "").trim();
    if (!text) {
      return "";
    }

    var cleaned = text
      .replace(/[.]/g, "/")
      .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1");
    if (cleaned.indexOf("T") !== -1) {
      cleaned = cleaned.split("T")[0];
    }
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(cleaned)) {
      var isoParts = cleaned.split(/[-/]/);
      var isoYear = Number(isoParts[0]);
      var isoMonth = Number(isoParts[1]);
      var isoDay = Number(isoParts[2]);
      if (isValidDateParts(isoYear, isoMonth, isoDay)) {
        return isoYear + "-" + padNumber(isoMonth) + "-" + padNumber(isoDay);
      }
      return "";
    }

    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(cleaned)) {
      var localParts = cleaned.split(/[-/]/);
      var first = Number(localParts[0]);
      var second = Number(localParts[1]);
      var year = Number(localParts[2]);
      if (year < 100) {
        year += 2000;
      }

      var day = first;
      var month = second;
      if (first <= 12 && second > 12) {
        month = first;
        day = second;
      }

      if (isValidDateParts(year, month, day)) {
        return year + "-" + padNumber(month) + "-" + padNumber(day);
      }
      return "";
    }

    var dayMonthYearMatch = cleaned.match(/^(\d{1,2})[\s\-\/]+([A-Za-z]{3,9})[\s,\-\/]+(\d{2,4})$/);
    if (dayMonthYearMatch) {
      var dmyDay = Number(dayMonthYearMatch[1]);
      var dmyMonth = getMonthIndexByName(dayMonthYearMatch[2]);
      var dmyYear = Number(dayMonthYearMatch[3]);
      if (dmyYear < 100) {
        dmyYear += 2000;
      }
      if (dmyMonth && isValidDateParts(dmyYear, dmyMonth, dmyDay)) {
        return dmyYear + "-" + padNumber(dmyMonth) + "-" + padNumber(dmyDay);
      }
      return "";
    }

    var monthDayYearMatch = cleaned.match(/^([A-Za-z]{3,9})[\s\-\/]+(\d{1,2})[,]?[\s\-\/]+(\d{2,4})$/);
    if (monthDayYearMatch) {
      var mdyMonth = getMonthIndexByName(monthDayYearMatch[1]);
      var mdyDay = Number(monthDayYearMatch[2]);
      var mdyYear = Number(monthDayYearMatch[3]);
      if (mdyYear < 100) {
        mdyYear += 2000;
      }
      if (mdyMonth && isValidDateParts(mdyYear, mdyMonth, mdyDay)) {
        return mdyYear + "-" + padNumber(mdyMonth) + "-" + padNumber(mdyDay);
      }
      return "";
    }

    var fallbackDate = new Date(cleaned);
    if (Number.isNaN(fallbackDate.getTime())) {
      return "";
    }
    return toDateInputValue(fallbackDate);
  }

  function isValidDateParts(year, month, day) {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return false;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    var date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function padNumber(number) {
    return String(number).padStart(2, "0");
  }

  function buildTransactionSignature(date, type, amount, accountId, notes) {
    return [
      date || "",
      type || "",
      toAmount(amount).toFixed(2),
      accountId || "",
      String(notes || "").trim().toLowerCase()
    ].join("|");
  }

  function parseTags(text) {
    return String(text || "")
      .split(",")
      .map(function (tag) {
        return tag.trim().toLowerCase();
      })
      .filter(function (tag, index, list) {
        return tag && list.indexOf(tag) === index;
      });
  }

  function isValidEmailAddress(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function toDateInputValue(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function toAmount(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function formatDate(dateString) {
    if (!dateString) {
      return "-";
    }
    var date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getClientTimeZone() {
    try {
      var resolved = Intl.DateTimeFormat().resolvedOptions();
      if (resolved && resolved.timeZone) {
        return String(resolved.timeZone).trim();
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  function formatMonthLabel(monthKey) {
    var parts = monthKey.split("-");
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return date.toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit"
    });
  }

  function formatMoney(amountValue) {
    var currency = state.user && state.user.settings && state.user.settings.currency ? state.user.settings.currency : "INR";
    var amount = toAmount(amountValue);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return currency + " " + amount.toFixed(2);
    }
  }

  function capitalize(text) {
    var value = String(text || "");
    if (!value) {
      return "";
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function downloadFile(name, content, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    downloadBlobFile(name, blob);
  }

  function downloadBlobFile(name, blob) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
})();
