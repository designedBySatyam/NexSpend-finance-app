(function () {
  "use strict";

  var SESSION_KEY = "finance_tracker_session_v1";

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

  function updateCurrentUser(updater) {
    var session = getSession();
    if (!session || !session.userId) {
      throw new Error("No active session.");
    }
    return window.FinanceStorage.updateUser(session.userId, updater);
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

  function signup(details) {
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
    var user = window.FinanceStorage.createUser({
      email: email,
      passwordHash: createHash(password),
      pinHash: normalizedPin ? createHash(normalizedPin) : ""
    });

    setSession({
      userId: user.id,
      isLocked: false,
      createdAt: new Date().toISOString()
    });

    return user;
  }

  function login(details) {
    var email = normalizeText(details.email).toLowerCase();
    var password = normalizeText(details.password);
    var user = window.FinanceStorage.findUserByEmail(email);

    if (!user) {
      throw new Error("No account found for that email.");
    }

    if (user.passwordHash !== createHash(password)) {
      throw new Error("Invalid password.");
    }

    setSession({
      userId: user.id,
      isLocked: false,
      lastLoginAt: new Date().toISOString()
    });

    return user;
  }

  function logout() {
    clearSession();
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

    if (createHash(normalizeText(pin)) !== pinHash) {
      throw new Error("Incorrect PIN.");
    }

    session.isLocked = false;
    session.unlockedAt = new Date().toISOString();
    setSession(session);
    return true;
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
      return user;
    });
  }

  window.AuthService = {
    signup: signup,
    login: login,
    logout: logout,
    lockSession: lockSession,
    unlockSession: unlockSession,
    isLocked: isLocked,
    setPin: setPin,
    getSession: getSession,
    getCurrentUser: getCurrentUser,
    updateCurrentUser: updateCurrentUser
  };
})();
