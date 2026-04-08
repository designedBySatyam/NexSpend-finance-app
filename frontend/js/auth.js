(function () {
  "use strict";

  var SESSION_KEY = "finance_tracker_session_v1";
  var DEFAULT_API_PATH = "/api";
  var API_REQUEST_TIMEOUT_MS = 15000;
  var syncQueue = Promise.resolve();
  var PIN_MAX_ATTEMPTS = 5;
  var PIN_LOCKOUT_MS = 5 * 60 * 1000;

  function safeParse(raw, fallbackValue) {
    try {
      if (!raw) {
        return fallbackValue;
      }
      var parsed = JSON.parse(raw);
      return parsed == null ? fallbackValue : parsed;
    } catch (error) {
      return fallbackValue;
    }
  }

  function normalizeText(text) {
    return String(text || "").trim();
  }

  function createHash(value) {
    var text = String(value || "");
    var hash = 0;
    for (var index = 0; index < text.length; index += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(index);
      hash |= 0;
    }
    return "h" + Math.abs(hash).toString(16);
  }

  function getSession() {
    return safeParse(localStorage.getItem(SESSION_KEY), null);
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getCurrentUser() {
    var session = getSession();
    if (!session || !session.userId) {
      return null;
    }
    return window.FinanceStorage.getUserById(session.userId);
  }

  function getApiBaseCandidates() {
    var candidates = [];

    function add(base) {
      var clean = String(base || "").trim().replace(/\/+$/, "");
      if (!clean) {
        return;
      }
      if (candidates.indexOf(clean) === -1) {
        candidates.push(clean);
      }
    }

    var configured = String(window.NEXSPEND_API_BASE || "").trim();
    if (configured) {
      add(configured);
    }

    var originApi = String(window.location.origin || "").replace(/\/+$/, "") + DEFAULT_API_PATH;
    add(originApi);

    var host = String(window.location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      add("http://localhost:4000/api");
      add("http://localhost:4100/api");
    }

    return candidates;
  }

  function isNetworkError(error) {
    var message = String(error && error.message ? error.message : "").toLowerCase();
    return (
      (error && error.name === "AbortError") ||
      message.indexOf("timed out") !== -1 ||
      message.indexOf("timeout") !== -1 ||
      message.indexOf("failed to fetch") !== -1 ||
      message.indexOf("networkerror") !== -1 ||
      message.indexOf("load failed") !== -1 ||
      message.indexOf("network request failed") !== -1
    );
  }

  async function parseApiError(response) {
    try {
      var payload = await response.json();
      return payload && payload.message ? payload.message : "Backend request failed.";
    } catch (error) {
      return "Backend request failed.";
    }
  }

  async function requestBackend(path, options) {
    var candidates = getApiBaseCandidates();
    var requestPath = String(path || "");
    if (requestPath.charAt(0) !== "/") {
      requestPath = "/" + requestPath;
    }

    var lastNetworkError = null;

    for (var index = 0; index < candidates.length; index += 1) {
      var base = candidates[index];
      try {
        var fetchOptions = Object.assign({}, options || {});
        var timeoutId = null;
        if (!fetchOptions.signal && typeof AbortController !== "undefined") {
          var controller = new AbortController();
          fetchOptions.signal = controller.signal;
          timeoutId = setTimeout(function () {
            controller.abort();
          }, API_REQUEST_TIMEOUT_MS);
        }
        var response = await fetch(base + requestPath, fetchOptions);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (response.status === 404 || response.status === 405) {
          continue;
        }

        if (!response.ok) {
          var error = new Error(await parseApiError(response));
          error.status = response.status;
          throw error;
        }

        var payload = null;
        try {
          payload = await response.json();
        } catch (jsonError) {
          payload = null;
        }

        return {
          base: base,
          payload: payload
        };
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (error && error.name === "AbortError") {
          lastNetworkError = new Error("Backend request timed out. Please try again.");
          continue;
        }
        if (isNetworkError(error)) {
          lastNetworkError = error;
          continue;
        }
        throw error;
      }
    }

    if (lastNetworkError) {
      var timeoutMessage = String(lastNetworkError.message || "").toLowerCase();
      if (timeoutMessage.indexOf("timed out") !== -1 || timeoutMessage.indexOf("timeout") !== -1) {
        throw new Error("Request timed out. Please try again.");
      }
      throw new Error("Cannot reach backend API. Start backend and retry.");
    }

    throw new Error("Cannot find backend API route.");
  }

  function validatePin(pin) {
    if (!pin) {
      return "";
    }
    var clean = normalizeText(pin);
    if (!/^\d{4,6}$/.test(clean)) {
      throw new Error("PIN must be 4 to 6 digits.");
    }
    return clean;
  }

  function getPinBlockedRemainingMs(session) {
    var blockedUntil = String(session && session.pinBlockedUntil ? session.pinBlockedUntil : "").trim();
    if (!blockedUntil) {
      return 0;
    }
    var parsed = new Date(blockedUntil);
    if (Number.isNaN(parsed.getTime())) {
      return 0;
    }
    return Math.max(0, parsed.getTime() - Date.now());
  }

  function formatRemainingTime(ms) {
    var totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    if (minutes > 0) {
      return minutes + "m " + String(seconds).padStart(2, "0") + "s";
    }
    return seconds + "s";
  }

  function serializeUserDataForBackend(user) {
    var source = user || {};
    return {
      id: source.id,
      email: source.email,
      profileName: source.profileName || "",
      transactions: Array.isArray(source.transactions) ? source.transactions : [],
      categories: Array.isArray(source.categories) ? source.categories : [],
      budgets: Array.isArray(source.budgets) ? source.budgets : [],
      reminders: Array.isArray(source.reminders) ? source.reminders : [],
      recurringRules: Array.isArray(source.recurringRules) ? source.recurringRules : [],
      goals: Array.isArray(source.goals) ? source.goals : [],
      accounts: Array.isArray(source.accounts) ? source.accounts : [],
      settings: source.settings || {
        currency: "INR",
        theme: "light",
        pinHash: ""
      }
    };
  }

  function getAuthHeaders(token) {
    var headers = {};
    if (token) {
      headers.Authorization = "Bearer " + token;
    }
    return headers;
  }

  function getSessionAuthToken() {
    var session = getSession();
    return session && session.authToken ? String(session.authToken) : "";
  }

  function upsertLocalUserFromBackend(payload, hints) {
    var backendUser = payload && payload.user ? payload.user : {};
    var backendData = payload && payload.data ? payload.data : {};
    var hintData = hints || {};

    var byId = backendUser.id ? window.FinanceStorage.getUserById(backendUser.id) : null;
    var byEmail = backendUser.email ? window.FinanceStorage.findUserByEmail(backendUser.email) : null;
    var existing = byId || byEmail;

    var nextId = backendUser.id || backendData.id || (existing && existing.id) || window.FinanceStorage.createId("user");
    var nextEmail = String(backendUser.email || backendData.email || hintData.email || (existing && existing.email) || "").toLowerCase().trim();
    var fallbackPinHash = hintData.pinHash || (existing && existing.pinHash) || (existing && existing.settings && existing.settings.pinHash) || "";

    var localUser = {
      id: nextId,
      email: nextEmail,
      profileName: String(backendData.profileName || backendUser.profileName || hintData.profileName || (existing && existing.profileName) || "").trim(),
      passwordHash: hintData.passwordHash || (existing && existing.passwordHash) || "",
      pinHash: fallbackPinHash,
      createdAt: backendUser.createdAt || (existing && existing.createdAt) || new Date().toISOString(),
      updatedAt: backendUser.updatedAt || new Date().toISOString(),
      transactions: backendData.transactions,
      categories: backendData.categories,
      budgets: backendData.budgets,
      reminders: backendData.reminders,
      recurringRules: backendData.recurringRules,
      goals: backendData.goals,
      accounts: backendData.accounts,
      settings: Object.assign({}, backendData.settings || {}, {
        pinHash: (backendData.settings && backendData.settings.pinHash) || fallbackPinHash
      })
    };

    return window.FinanceStorage.upsertUser(localUser);
  }

  function establishSession(userId, token, sourceLabel) {
    var previous = getSession() || {};
    var sameUserSession = previous && previous.userId === userId ? previous : {};
    setSession({
      userId: userId,
      authToken: token || previous.authToken || "",
      isLocked: false,
      pinFailedAttempts: Number(sameUserSession.pinFailedAttempts || 0),
      pinBlockedUntil: sameUserSession.pinBlockedUntil || "",
      lastLoginAt: new Date().toISOString(),
      source: sourceLabel || "backend"
    });
  }

  async function pushCurrentUserToBackend(user, token) {
    if (!token || !user) {
      return null;
    }

    var response = await requestBackend("/user", {
      method: "PUT",
      headers: Object.assign({
        "Content-Type": "application/json"
      }, getAuthHeaders(token)),
      body: JSON.stringify({
        data: serializeUserDataForBackend(user),
        email: user.email,
        profileName: user.profileName || ""
      })
    });

    if (response && response.payload) {
      var updated = upsertLocalUserFromBackend(response.payload, {
        email: user.email,
        profileName: user.profileName || "",
        passwordHash: user.passwordHash || "",
        pinHash: user.pinHash || (user.settings && user.settings.pinHash) || ""
      });
      var session = getSession();
      if (session && updated && updated.id && session.userId !== updated.id) {
        session.userId = updated.id;
        setSession(session);
      }
      return updated;
    }

    return null;
  }

  function queueBackendSync(user, token) {
    if (!token || !user) {
      return;
    }
    syncQueue = syncQueue
      .then(function () {
        return pushCurrentUserToBackend(user, token);
      })
      .catch(function (error) {
        if (error && error.status === 401) {
          clearSession();
          return null;
        }
        return null;
      });
  }

  function updateCurrentUser(updater) {
    var session = getSession();
    if (!session || !session.userId) {
      throw new Error("No active session.");
    }

    var updatedUser = window.FinanceStorage.updateUser(session.userId, updater);
    if (session.authToken) {
      queueBackendSync(updatedUser, session.authToken);
    }
    return updatedUser;
  }

  async function signup(details) {
    var email = normalizeText(details.email).toLowerCase();
    var password = normalizeText(details.password);
    var pin = normalizeText(details.pin || "");

    if (!email) {
      throw new Error("Email is required.");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    var normalizedPin = validatePin(pin);
    var response = await requestBackend("/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        password: password,
        pin: normalizedPin
      })
    });

    var user = upsertLocalUserFromBackend(response.payload || {}, {
      email: email,
      passwordHash: createHash(password),
      pinHash: normalizedPin ? createHash(normalizedPin) : ""
    });

    establishSession(user.id, response && response.payload ? response.payload.token : "", "backend-signup");
    return user;
  }

  async function login(details) {
    var email = normalizeText(details.email).toLowerCase();
    var password = normalizeText(details.password);

    if (!email) {
      throw new Error("Email is required.");
    }
    if (!password) {
      throw new Error("Password is required.");
    }

    var response = await requestBackend("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    var existing = window.FinanceStorage.findUserByEmail(email);
    var user = upsertLocalUserFromBackend(response.payload || {}, {
      email: email,
      passwordHash: (existing && existing.passwordHash) || createHash(password),
      pinHash: (existing && existing.settings && existing.settings.pinHash) || (existing && existing.pinHash) || ""
    });

    establishSession(user.id, response && response.payload ? response.payload.token : "", "backend-login");
    return user;
  }

  function logout() {
    var session = getSession();
    clearSession();

    if (session && session.authToken) {
      requestBackend("/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(session.authToken)
      }).catch(function () {
        return null;
      });
    }
  }

  async function changePassword(details) {
    var sessionToken = getSessionAuthToken();
    if (!sessionToken) {
      throw new Error("No active authenticated session.");
    }

    var currentPassword = normalizeText(details && details.currentPassword);
    var newPassword = normalizeText(details && details.newPassword);

    if (!currentPassword) {
      throw new Error("Current password is required.");
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters.");
    }

    var response = await requestBackend("/auth/change-password", {
      method: "POST",
      headers: Object.assign({
        "Content-Type": "application/json"
      }, getAuthHeaders(sessionToken)),
      body: JSON.stringify({
        currentPassword: currentPassword,
        newPassword: newPassword
      })
    });

    var user = getCurrentUser();
    if (user) {
      updateCurrentUser(function (nextUser) {
        nextUser.passwordHash = createHash(newPassword);
        nextUser.updatedAt = new Date().toISOString();
        return nextUser;
      });
    }

    return response && response.payload ? response.payload : { ok: true };
  }

  async function requestPasswordReset(email) {
    var normalizedEmail = normalizeText(email).toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Email is required.");
    }

    var response = await requestBackend("/auth/forgot-password/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: normalizedEmail
      })
    });

    return response && response.payload ? response.payload : { ok: true };
  }

  async function confirmPasswordReset(payload) {
    var email = normalizeText(payload && payload.email).toLowerCase();
    var code = normalizeText(payload && payload.code);
    var newPassword = normalizeText(payload && payload.newPassword);

    if (!email) {
      throw new Error("Email is required.");
    }
    if (!code) {
      throw new Error("Reset code is required.");
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters.");
    }

    var response = await requestBackend("/auth/forgot-password/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        code: code,
        newPassword: newPassword
      })
    });

    var localUser = window.FinanceStorage.findUserByEmail(email);
    if (localUser) {
      window.FinanceStorage.updateUser(localUser.id, function (user) {
        user.passwordHash = createHash(newPassword);
        user.updatedAt = new Date().toISOString();
        return user;
      });
    }

    return response && response.payload ? response.payload : { ok: true };
  }

  function lockSession() {
    var session = getSession();
    var user = getCurrentUser();
    if (!session || !user) {
      return;
    }
    var pinHash = user.settings && user.settings.pinHash ? user.settings.pinHash : "";
    if (!pinHash) {
      throw new Error("Set a PIN in sign-up before using lock.");
    }
    session.isLocked = true;
    session.pinFailedAttempts = 0;
    session.pinBlockedUntil = "";
    setSession(session);
  }

  function unlockSession(pin) {
    var session = getSession();
    var user = getCurrentUser();
    if (!session || !user) {
      throw new Error("No active session.");
    }

    var pinHash = user.settings && user.settings.pinHash ? user.settings.pinHash : "";
    if (!pinHash) {
      throw new Error("No PIN available for this account.");
    }

    var remainingMs = getPinBlockedRemainingMs(session);
    if (remainingMs > 0) {
      throw new Error("Too many incorrect PIN attempts. Try again in " + formatRemainingTime(remainingMs) + ".");
    }

    if (createHash(normalizeText(pin)) !== pinHash) {
      var attempts = Number(session.pinFailedAttempts || 0) + 1;
      if (attempts >= PIN_MAX_ATTEMPTS) {
        session.pinFailedAttempts = 0;
        session.pinBlockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString();
        setSession(session);
        throw new Error("Too many incorrect PIN attempts. Try again in " + formatRemainingTime(PIN_LOCKOUT_MS) + ".");
      }
      session.pinFailedAttempts = attempts;
      session.pinBlockedUntil = "";
      setSession(session);
      throw new Error("Incorrect PIN. " + (PIN_MAX_ATTEMPTS - attempts) + " attempt(s) left.");
    }

    session.isLocked = false;
    session.pinFailedAttempts = 0;
    session.pinBlockedUntil = "";
    session.unlockedAt = new Date().toISOString();
    setSession(session);
    return true;
  }

  function getPinSecurityStatus() {
    var session = getSession();
    var attempts = Number(session && session.pinFailedAttempts ? session.pinFailedAttempts : 0);
    var remainingMs = getPinBlockedRemainingMs(session);
    return {
      maxAttempts: PIN_MAX_ATTEMPTS,
      attemptsUsed: attempts,
      attemptsLeft: Math.max(0, PIN_MAX_ATTEMPTS - attempts),
      isBlocked: remainingMs > 0,
      remainingMs: remainingMs
    };
  }

  function isLocked() {
    var session = getSession();
    return Boolean(session && session.isLocked);
  }

  function setPin(pin) {
    var cleanPin = validatePin(pin);
    if (!cleanPin) {
      throw new Error("PIN cannot be empty.");
    }
    return updateCurrentUser(function (user) {
      user.settings = user.settings || {};
      user.settings.pinHash = createHash(cleanPin);
      user.pinHash = user.settings.pinHash;
      return user;
    });
  }

  async function refreshCurrentUserFromBackend() {
    var session = getSession();
    if (!session || !session.userId || !session.authToken) {
      return getCurrentUser();
    }

    var response = await requestBackend("/user", {
      method: "GET",
      headers: getAuthHeaders(session.authToken)
    });

    var current = getCurrentUser();
    var updated = upsertLocalUserFromBackend(response.payload || {}, {
      email: current && current.email ? current.email : "",
      profileName: current && current.profileName ? current.profileName : "",
      passwordHash: current && current.passwordHash ? current.passwordHash : "",
      pinHash: current && current.settings && current.settings.pinHash ? current.settings.pinHash : ""
    });

    if (updated && updated.id !== session.userId) {
      session.userId = updated.id;
      setSession(session);
    }

    return updated;
  }

  window.AuthService = {
    signup: signup,
    login: login,
    logout: logout,
    changePassword: changePassword,
    requestPasswordReset: requestPasswordReset,
    confirmPasswordReset: confirmPasswordReset,
    lockSession: lockSession,
    unlockSession: unlockSession,
    isLocked: isLocked,
    setPin: setPin,
    getSession: getSession,
    getPinSecurityStatus: getPinSecurityStatus,
    getCurrentUser: getCurrentUser,
    updateCurrentUser: updateCurrentUser,
    refreshCurrentUserFromBackend: refreshCurrentUserFromBackend
  };
})();
