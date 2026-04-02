(function () {
  "use strict";

  var USERS_KEY = "finance_tracker_users_v1";

  var DEFAULT_CATEGORIES = [
    { id: "cat_food", name: "Food", type: "expense", system: true },
    { id: "cat_rent", name: "Rent", type: "expense", system: true },
    { id: "cat_travel", name: "Travel", type: "expense", system: true },
    { id: "cat_bills", name: "Bills", type: "expense", system: true },
    { id: "cat_shopping", name: "Shopping", type: "expense", system: true },
    { id: "cat_health", name: "Health", type: "expense", system: true },
    { id: "cat_subscriptions", name: "Subscriptions", type: "expense", system: true },
    { id: "cat_salary", name: "Salary", type: "income", system: true },
    { id: "cat_freelance", name: "Freelance", type: "income", system: true },
    { id: "cat_investment", name: "Investment", type: "income", system: true }
  ];

  var DEFAULT_ACCOUNTS = [
    { id: "acct_wallet", name: "Cash Wallet", type: "wallet", initialBalance: 0 }
  ];

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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createId(prefix) {
    return (prefix || "id") + "_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
  }

  function normalizeUser(user) {
    var normalized = clone(user || {});
    normalized.transactions = Array.isArray(normalized.transactions) ? normalized.transactions : [];
    normalized.categories = Array.isArray(normalized.categories) ? normalized.categories : clone(DEFAULT_CATEGORIES);
    normalized.budgets = Array.isArray(normalized.budgets) ? normalized.budgets : [];
    normalized.reminders = Array.isArray(normalized.reminders) ? normalized.reminders : [];
    normalized.recurringRules = Array.isArray(normalized.recurringRules) ? normalized.recurringRules : [];
    normalized.goals = Array.isArray(normalized.goals) ? normalized.goals : [];
    normalized.accounts = Array.isArray(normalized.accounts) && normalized.accounts.length > 0 ? normalized.accounts : clone(DEFAULT_ACCOUNTS);
    normalized.settings = normalized.settings || {};
    normalized.settings.currency = normalized.settings.currency || "INR";
    normalized.settings.theme = normalized.settings.theme || "light";
    normalized.settings.pinHash = normalized.settings.pinHash || normalized.pinHash || "";
    return normalized;
  }

  function getUsers() {
    var users = safeParse(localStorage.getItem(USERS_KEY), []);
    if (!Array.isArray(users)) {
      return [];
    }
    return users.map(normalizeUser);
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function findUserIndexById(users, userId) {
    return users.findIndex(function (user) {
      return user.id === userId;
    });
  }

  function getUserById(userId) {
    var users = getUsers();
    var match = users.find(function (user) {
      return user.id === userId;
    });
    return match ? clone(match) : null;
  }

  function findUserByEmail(email) {
    var lookup = String(email || "").toLowerCase().trim();
    var users = getUsers();
    var found = users.find(function (user) {
      return String(user.email || "").toLowerCase().trim() === lookup;
    });
    return found ? clone(found) : null;
  }

  function createUser(payload) {
    var users = getUsers();
    var email = String(payload.email || "").toLowerCase().trim();
    var exists = users.some(function (user) {
      return String(user.email || "").toLowerCase().trim() === email;
    });

    if (exists) {
      throw new Error("An account with this email already exists.");
    }

    var user = normalizeUser({
      id: createId("user"),
      email: email,
      passwordHash: payload.passwordHash,
      pinHash: payload.pinHash || "",
      createdAt: new Date().toISOString(),
      transactions: [],
      categories: clone(DEFAULT_CATEGORIES),
      budgets: [],
      reminders: [],
      recurringRules: [],
      goals: [],
      accounts: clone(DEFAULT_ACCOUNTS),
      settings: {
        currency: "INR",
        theme: "light",
        pinHash: payload.pinHash || ""
      }
    });

    users.push(user);
    saveUsers(users);
    return clone(user);
  }

  function updateUser(userId, updater) {
    var users = getUsers();
    var userIndex = findUserIndexById(users, userId);

    if (userIndex === -1) {
      throw new Error("User not found.");
    }

    var current = clone(users[userIndex]);
    var next = typeof updater === "function" ? updater(current) : current;
    users[userIndex] = normalizeUser(next);
    saveUsers(users);
    return clone(users[userIndex]);
  }

  function replaceUser(userId, userData) {
    return updateUser(userId, function () {
      var next = normalizeUser(userData);
      next.id = userId;
      return next;
    });
  }

  function removeItemById(list, itemId) {
    return (list || []).filter(function (item) {
      return item.id !== itemId;
    });
  }

  window.FinanceStorage = {
    createId: createId,
    getUsers: getUsers,
    getUserById: getUserById,
    findUserByEmail: findUserByEmail,
    createUser: createUser,
    updateUser: updateUser,
    replaceUser: replaceUser,
    removeItemById: removeItemById,
    defaults: {
      categories: clone(DEFAULT_CATEGORIES),
      accounts: clone(DEFAULT_ACCOUNTS)
    }
  };
})();
