const express = require("express");
const cors = require("cors");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const pdfParse = require("pdf-parse");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

let cachedPdfJsLib = null;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024
  }
});

const PORT = Number(process.env.PORT || 4000);
const DB_PATH = path.join(__dirname, "..", "data", "db.json");
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");
function normalizeMongoUri(value) {
  let uri = String(value || "").trim();
  if (!uri) {
    return "";
  }
  if (/^MONGODB_URI\s*=/i.test(uri)) {
    uri = uri.replace(/^MONGODB_URI\s*=\s*/i, "").trim();
  }
  if (
    (uri.startsWith('"') && uri.endsWith('"')) ||
    (uri.startsWith("'") && uri.endsWith("'"))
  ) {
    uri = uri.slice(1, -1).trim();
  }
  return uri;
}

const MONGODB_URI = normalizeMongoUri(process.env.MONGODB_URI);
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || "nexspend").trim() || "nexspend";
const USE_MONGODB = Boolean(MONGODB_URI);
const USERS_COLLECTION_NAME = "users";
const SESSIONS_COLLECTION_NAME = "sessions";
const RESET_CODE_TTL_MINUTES = Number(process.env.RESET_CODE_TTL_MINUTES || 15);

let mongoClient = null;
let mongoDb = null;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      users: [],
      sessions: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readDb() {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };
  } catch (error) {
    return {
      users: [],
      sessions: []
    };
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function withDb(mutator) {
  const db = readDb();
  const value = mutator(db);
  writeDb(db);
  return value;
}

function isMongoDuplicateKeyError(error) {
  return Boolean(error && error.code === 11000);
}

async function initializeStorage() {
  if (!USE_MONGODB) {
    ensureDbFile();
    return "file";
  }

  const hasValidScheme =
    MONGODB_URI.startsWith("mongodb://") ||
    MONGODB_URI.startsWith("mongodb+srv://");
  if (!hasValidScheme) {
    throw new Error(
      "Invalid MONGODB_URI. It must start with mongodb:// or mongodb+srv://. " +
      "In Render, set only the URI value (no MONGODB_URI= prefix, no quotes)."
    );
  }

  mongoClient = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10
  });
  await mongoClient.connect();
  mongoDb = mongoClient.db(MONGODB_DB_NAME);

  const usersCollection = mongoDb.collection(USERS_COLLECTION_NAME);
  const sessionsCollection = mongoDb.collection(SESSIONS_COLLECTION_NAME);

  await Promise.all([
    usersCollection.createIndex({ id: 1 }, { unique: true }),
    usersCollection.createIndex({ email: 1 }, { unique: true }),
    sessionsCollection.createIndex({ token: 1 }, { unique: true }),
    sessionsCollection.createIndex({ userId: 1 })
  ]);

  return "mongo";
}

function getMongoCollection(name) {
  if (!mongoDb) {
    throw new Error("MongoDB is not initialized.");
  }
  return mongoDb.collection(name);
}

async function findAuthContextByToken(token) {
  if (USE_MONGODB) {
    const sessionsCollection = getMongoCollection(SESSIONS_COLLECTION_NAME);
    const usersCollection = getMongoCollection(USERS_COLLECTION_NAME);

    const session = await sessionsCollection.findOne({ token: token });
    if (!session) {
      return { session: null, user: null };
    }

    const user = await usersCollection.findOne({ id: session.userId });
    return { session: session, user: user || null };
  }

  const db = readDb();
  const session = db.sessions.find(function (item) {
    return item.token === token;
  });
  if (!session) {
    return { session: null, user: null };
  }
  const user = db.users.find(function (item) {
    return item.id === session.userId;
  });
  return { session: session, user: user || null };
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createResetCodeExpiryIso() {
  return new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000).toISOString();
}

function isExpiredIsoDate(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return true;
  }
  return date.getTime() < Date.now();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createDefaultUserData(email) {
  return {
    id: "user_" + Date.now(),
    email: email,
    transactions: [],
    profileName: "",
    categories: [
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
    ],
    budgets: [],
    reminders: [],
    recurringRules: [],
    goals: [],
    accounts: [
      { id: "acct_wallet", name: "Cash Wallet", type: "wallet", initialBalance: 0 }
    ],
    settings: {
      currency: "INR",
      theme: "light",
      pinHash: ""
    }
  };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    profileName: user.profileName || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return String(req.headers["x-auth-token"] || "").trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = getAuthToken(req);
    if (!token) {
      res.status(401).json({ message: "Authentication token is required." });
      return;
    }

    const authContext = await findAuthContextByToken(token);
    if (!authContext.session) {
      res.status(401).json({ message: "Invalid or expired session token." });
      return;
    }
    if (!authContext.user) {
      res.status(401).json({ message: "User for this session was not found." });
      return;
    }

    req.sessionToken = token;
    req.authUser = authContext.user;
    next();
  } catch (error) {
    next(error);
  }
}

function parseAmountText(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return 0;
  }

  const negativeByBracket = /^\(.*\)$/.test(raw);
  const normalized = raw.replace(/[\s,]/g, "").replace(/[^\d.\-]/g, "");
  if (!normalized || normalized === "." || normalized === "-" || normalized === "-.") {
    return 0;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    return 0;
  }

  if (negativeByBracket) {
    return -Math.abs(amount);
  }
  return amount;
}

function isValidDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

const MONTH_INDEX_BY_NAME = {
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

function getMonthIndexByName(monthName) {
  return MONTH_INDEX_BY_NAME[String(monthName || "").trim().toLowerCase()] || 0;
}

function extractDateCandidateFromText(text) {
  const source = String(text || "");
  if (!source) {
    return "";
  }

  const datePatterns = [
    /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,
    /\b\d{1,2}(?:st|nd|rd|th)?[\s\-\/]+[A-Za-z]{3,9}[\s,\-\/]+\d{2,4}\b/i,
    /\b[A-Za-z]{3,9}[\s\-\/]+\d{1,2}(?:st|nd|rd|th)?[,]?[\s\-\/]+\d{2,4}\b/i
  ];

  for (const pattern of datePatterns) {
    const match = source.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return "";
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  let cleaned = text
    .replace(/[.]/g, "/")
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1");
  if (cleaned.indexOf("T") !== -1) {
    cleaned = cleaned.split("T")[0];
  }

  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(cleaned)) {
    const parts = cleaned.split(/[-/]/);
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (isValidDate(year, month, day)) {
      return year + "-" + pad2(month) + "-" + pad2(day);
    }
    return "";
  }

  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(cleaned)) {
    const parts = cleaned.split(/[-/]/);
    let first = Number(parts[0]);
    let second = Number(parts[1]);
    let year = Number(parts[2]);

    if (year < 100) {
      year += 2000;
    }

    let day = first;
    let month = second;
    if (first <= 12 && second > 12) {
      month = first;
      day = second;
    }

    if (isValidDate(year, month, day)) {
      return year + "-" + pad2(month) + "-" + pad2(day);
    }
    return "";
  }

  const dayMonthYearMatch = cleaned.match(/^(\d{1,2})[\s\-\/]+([A-Za-z]{3,9})[\s,\-\/]+(\d{2,4})$/);
  if (dayMonthYearMatch) {
    const day = Number(dayMonthYearMatch[1]);
    const month = getMonthIndexByName(dayMonthYearMatch[2]);
    let year = Number(dayMonthYearMatch[3]);
    if (year < 100) {
      year += 2000;
    }
    if (month && isValidDate(year, month, day)) {
      return year + "-" + pad2(month) + "-" + pad2(day);
    }
    return "";
  }

  const monthDayYearMatch = cleaned.match(/^([A-Za-z]{3,9})[\s\-\/]+(\d{1,2})[,]?[\s\-\/]+(\d{2,4})$/);
  if (monthDayYearMatch) {
    const month = getMonthIndexByName(monthDayYearMatch[1]);
    const day = Number(monthDayYearMatch[2]);
    let year = Number(monthDayYearMatch[3]);
    if (year < 100) {
      year += 2000;
    }
    if (month && isValidDate(year, month, day)) {
      return year + "-" + pad2(month) + "-" + pad2(day);
    }
    return "";
  }

  const fallback = new Date(cleaned);
  if (Number.isNaN(fallback.getTime())) {
    return "";
  }
  return fallback.toISOString().slice(0, 10);
}

function normalizeType(value, amount) {
  const text = String(value || "").trim().toLowerCase();
  if (
    text === "income" ||
    text === "credit" ||
    text === "cr" ||
    text === "deposit" ||
    text === "inflow" ||
    text === "received"
  ) {
    return "income";
  }

  if (
    text === "expense" ||
    text === "debit" ||
    text === "dr" ||
    text === "withdrawal" ||
    text === "outflow" ||
    text === "spent"
  ) {
    return "expense";
  }

  return amount < 0 ? "expense" : "income";
}

function cleanDescription(line, dateText, amountText) {
  let description = String(line || "");
  if (dateText) {
    description = description.replace(dateText, " ");
  }
  if (amountText) {
    description = description.replace(amountText, " ");
  }
  description = description.replace(/\b(?:debit|credit|dr|cr)\b/gi, " ");
  description = description.replace(/\s+/g, " ").trim();
  return description;
}

function extractAmountCandidates(line) {
  return String(line || "").match(/(?:\(|-)?(?:INR|Rs\.?|\u20B9|\$|EUR|GBP)\s*\d[\d,]*(?:\.\d{1,2})?\)?|(?:\(|-)?\d[\d,]*\.\d{1,2}\)?/gi) || [];
}

function hasFinancialSignal(text) {
  const source = String(text || "");
  return (
    /\b(upi|phonepe|transaction|txn|utr|ref(?:erence)?|paid|received|debit|credit|debited|credited|sent|transfer|merchant|wallet|bank|payment)\b/i.test(source) ||
    /(?:INR|Rs\.?|\u20B9|\$|EUR|GBP)/i.test(source)
  );
}

function parsePhonePeTransactionsFromText(text) {
  const source = String(text || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!source) {
    return [];
  }

  const dateTimeRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+(?:AM|PM)\b/gi;
  const matches = Array.from(source.matchAll(dateTimeRegex));
  if (matches.length === 0) {
    return [];
  }

  const transactions = [];
  const seen = new Set();

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const start = current.index;
    const end = index < matches.length - 1 ? matches[index + 1].index : source.length;
    const chunk = source.slice(start, end).trim();
    const dateTimeToken = String(current[0] || "").trim();
    if (!chunk || !dateTimeToken) {
      continue;
    }

    if (!/\b(transaction id|utr no|debited|credited|paid|received)\b/i.test(chunk)) {
      continue;
    }

    const datePart = dateTimeToken.replace(/\s+\d{1,2}:\d{2}\s+(AM|PM)$/i, "").trim();
    const normalizedDate = normalizeDate(datePart);
    if (!normalizedDate) {
      continue;
    }

    const amountMatches = Array.from(chunk.matchAll(/INR\s*([0-9,]+(?:\.\d{1,2})?)/gi));
    if (amountMatches.length === 0) {
      continue;
    }

    const amountRaw = amountMatches[amountMatches.length - 1][1];
    const amountValue = parseAmountText(amountRaw);
    if (!(amountValue > 0)) {
      continue;
    }

    let type = "expense";
    if (/\b(credited|received)\b/i.test(chunk)) {
      type = "income";
    } else if (/\b(debited|paid|sent)\b/i.test(chunk)) {
      type = "expense";
    }

    const description = chunk
      .replace(dateTimeToken, " ")
      .replace(/\bTransaction ID\s*:\s*[\w-]+/gi, " ")
      .replace(/\bUTR No\s*:\s*[\w-]+/gi, " ")
      .replace(/\b(?:Debited|Credited)\s+(?:to|from)\s+\S+/gi, " ")
      .replace(/\bINR\s*[0-9,]+(?:\.\d{1,2})?/gi, " ")
      .replace(/\bPage\s+\d+\s+of\s+\d+\b/gi, " ")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const notes = description || "PhonePe transaction";
    const signature = [
      normalizedDate,
      type,
      Number(amountValue).toFixed(2),
      notes.toLowerCase().slice(0, 120)
    ].join("|");

    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);

    transactions.push({
      date: normalizedDate,
      amount: Math.abs(amountValue),
      type: type,
      description: notes,
      notes: notes,
      category: "",
      account: "",
      tags: []
    });
  }

  return transactions;
}

function parseTransactionLine(line, fallbackDateToken) {
  const dateToken = extractDateCandidateFromText(line) || String(fallbackDateToken || "").trim();
  if (!dateToken) {
    return null;
  }

  const amountMatches = extractAmountCandidates(line);
  let amountText = "";
  let amountValue = 0;

  for (let index = amountMatches.length - 1; index >= 0; index -= 1) {
    const candidate = amountMatches[index];
    const parsed = parseAmountText(candidate);
    if (parsed !== 0) {
      amountText = candidate;
      amountValue = parsed;
      break;
    }
  }

  if (!amountText) {
    return null;
  }

  if (!hasFinancialSignal(line)) {
    return null;
  }

  const normalizedDate = normalizeDate(dateToken);
  if (!normalizedDate) {
    return null;
  }

  const lowerLine = line.toLowerCase();
  const keywordType = /\b(credit|cr|deposit|salary|refund|received)\b/.test(lowerLine)
    ? "income"
    : /\b(debit|dr|withdraw|purchase|bill|paid|payment)\b/.test(lowerLine)
      ? "expense"
      : "";

  const type = normalizeType(keywordType, amountValue);
  const description = cleanDescription(line, dateToken, amountText);

  return {
    date: normalizedDate,
    amount: Math.abs(amountValue),
    type: type,
    description: description,
    notes: description,
    category: "",
    account: "",
    tags: []
  };
}

function extractTransactionsFromPdfText(text) {
  const phonePeParsed = parsePhonePeTransactionsFromText(text);
  if (phonePeParsed.length > 0) {
    return phonePeParsed;
  }

  const lines = String(text || "")
    .split(/\r?\n/)
    .map(function (line) {
      return line.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);

  const transactions = [];
  const seen = new Set();
  let recentDateToken = "";

  function addParsedIfNew(parsed) {
    if (!parsed) {
      return false;
    }
    const signature = [
      parsed.date,
      parsed.type,
      Number(parsed.amount).toFixed(2),
      String(parsed.notes || "").toLowerCase()
    ].join("|");
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    transactions.push(parsed);
    return true;
  }

  lines.forEach(function (line, index) {
    const ownDateToken = extractDateCandidateFromText(line);
    if (ownDateToken) {
      recentDateToken = ownDateToken;
    }

    if (addParsedIfNew(parseTransactionLine(line, recentDateToken))) {
      return;
    }

    if (index < lines.length - 1) {
      const combined = line + " " + lines[index + 1];
      const combinedDateToken = extractDateCandidateFromText(combined) || recentDateToken;
      if (combinedDateToken) {
        recentDateToken = combinedDateToken;
      }
      addParsedIfNew(parseTransactionLine(combined, combinedDateToken));
    }
  });

  return transactions;
}

async function extractPdfText(buffer) {
  return extractPdfTextWithPassword(buffer, "");
}

function isPdfPasswordError(error) {
  const text = String(error && error.message ? error.message : error || "").toLowerCase();
  return (
    text.indexOf("password") !== -1 ||
    text.indexOf("encrypted") !== -1 ||
    text.indexOf("security handler") !== -1
  );
}

function createPdfError(message, code, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause && cause.message) {
    error.cause = cause.message;
  }
  return error;
}

async function loadPdfJsLib() {
  if (cachedPdfJsLib) {
    return cachedPdfJsLib;
  }

  try {
    const moduleNs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    cachedPdfJsLib = moduleNs && moduleNs.getDocument ? moduleNs : (moduleNs.default || moduleNs);
    if (!cachedPdfJsLib || typeof cachedPdfJsLib.getDocument !== "function") {
      throw new Error("pdfjs getDocument API not found.");
    }
    return cachedPdfJsLib;
  } catch (error) {
    throw createPdfError("No compatible PDF parser fallback is available.", "PDF_PARSER_UNAVAILABLE", error);
  }
}

async function extractPdfTextUsingPdfJs(buffer, password) {
  const pdfjsLib = await loadPdfJsLib();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    password: password || undefined
  });
  const document = await loadingTask.promise;
  const chunks = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = (content.items || []).map(function (item) {
      return String(item.str || "");
    }).join(" ");
    chunks.push(pageText);
  }

  return chunks.join("\n");
}

async function extractPdfTextWithPassword(buffer, password) {
  const cleanPassword = String(password || "").trim();

  if (cleanPassword) {
    try {
      const text = await extractPdfTextUsingPdfJs(buffer, cleanPassword);
      if (String(text || "").trim()) {
        return text;
      }
      throw createPdfError("No readable text found in PDF.", "PDF_TEXT_EMPTY");
    } catch (error) {
      if (isPdfPasswordError(error)) {
        throw createPdfError("Incorrect PDF password.", "PDF_PASSWORD_INVALID", error);
      }
      throw error;
    }
  }

  try {
    const parsed = await pdfParse(buffer);
    if (parsed && String(parsed.text || "").trim()) {
      return parsed.text;
    }
  } catch (error) {
    if (isPdfPasswordError(error)) {
      throw createPdfError("This PDF is password protected.", "PDF_PASSWORD_REQUIRED", error);
    }
    // Continue to pdfjs fallback below.
  }

  try {
    const text = await extractPdfTextUsingPdfJs(buffer, "");
    if (String(text || "").trim()) {
      return text;
    }
    throw createPdfError("No readable text found in PDF.", "PDF_TEXT_EMPTY");
  } catch (error) {
    if (isPdfPasswordError(error)) {
      throw createPdfError("This PDF is password protected.", "PDF_PASSWORD_REQUIRED", error);
    }
    throw error;
  }
}

function formatCurrency(amount, currency) {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2
    }).format(value);
  } catch (error) {
    return String(value.toFixed(2));
  }
}

function safeText(value) {
  const text = String(value == null ? "" : value);
  return text.length > 180 ? text.slice(0, 177) + "..." : text;
}

function csvCell(value) {
  const text = String(value == null ? "" : value);
  if (text.indexOf(",") >= 0 || text.indexOf('"') >= 0 || text.indexOf("\n") >= 0) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function normalizeExportPassword(rawPassword) {
  const password = String(rawPassword || "").trim();
  if (!password) {
    return { error: "Password is required for protected export." };
  }
  if (password.length < 4) {
    return { error: "Password must be at least 4 characters." };
  }
  return { value: password };
}

function buildCsvText(transactions) {
  const rows = [["id", "date", "type", "amount", "category", "account", "tags", "notes"]];
  transactions.forEach(function (transaction) {
    rows.push([
      transaction.id || "",
      transaction.date || "",
      transaction.type || "",
      Number(transaction.amount || 0).toFixed(2),
      transaction.category || "Uncategorized",
      transaction.account || "Unknown",
      Array.isArray(transaction.tags) ? transaction.tags.join("|") : (transaction.tags || ""),
      transaction.notes || ""
    ]);
  });
  return rows.map(function (row) {
    return row.map(csvCell).join(",");
  }).join("\n");
}

function buildEncryptedCsvBuffer(csvText, password) {
  const plaintext = Buffer.from(String(csvText || ""), "utf8");
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const metadata = {
    format: "NEXSPEND_CSV_ENC_V1",
    algorithm: "aes-256-gcm",
    kdf: "scrypt",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
    encoding: "utf8"
  };

  const header = Buffer.from("NEXSPEND_CSV_ENC_V1\n", "utf8");
  const metadataLine = Buffer.from(JSON.stringify(metadata) + "\n", "utf8");
  return Buffer.concat([header, metadataLine, ciphertext]);
}

function buildPdfDocOptions(password) {
  return {
    size: "A4",
    margin: 36,
    userPassword: password,
    ownerPassword: crypto.randomBytes(24).toString("hex"),
    permissions: {
      printing: "highResolution",
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false
    }
  };
}

app.get("/api/health", function (_req, res) {
  res.json({
    ok: true,
    service: "nexspend-backend",
    now: new Date().toISOString()
  });
});

app.post("/api/auth/signup", async function (req, res, next) {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const password = String((req.body && req.body.password) || "").trim();
    const pin = String((req.body && req.body.pin) || "").trim();

    if (!isValidEmail(email)) {
      res.status(400).json({ message: "A valid email is required." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters." });
      return;
    }
    if (pin && !/^\d{4,6}$/.test(pin)) {
      res.status(400).json({ message: "PIN must be 4 to 6 digits." });
      return;
    }

    if (USE_MONGODB) {
      const usersCollection = getMongoCollection(USERS_COLLECTION_NAME);
      const sessionsCollection = getMongoCollection(SESSIONS_COLLECTION_NAME);
      const now = new Date().toISOString();
      const user = {
        id: "usr_" + Date.now() + "_" + Math.floor(Math.random() * 1000000),
        email: email,
        profileName: String((req.body && req.body.profileName) || "").trim(),
        passwordHash: hashText(password),
        pinHash: pin ? hashText(pin) : "",
        createdAt: now,
        updatedAt: now,
        data: createDefaultUserData(email)
      };

      try {
        await usersCollection.insertOne(user);
      } catch (error) {
        if (isMongoDuplicateKeyError(error)) {
          res.status(409).json({ message: "An account with this email already exists." });
          return;
        }
        throw error;
      }

      const token = createToken();
      await sessionsCollection.insertOne({
        token: token,
        userId: user.id,
        createdAt: now,
        lastSeenAt: now
      });

      res.status(201).json({
        token: token,
        user: sanitizeUser(user),
        data: user.data
      });
      return;
    }

    const result = withDb(function (db) {
      const exists = db.users.some(function (item) {
        return item.email === email;
      });
      if (exists) {
        return { error: "An account with this email already exists." };
      }

      const now = new Date().toISOString();
      const user = {
        id: "usr_" + Date.now() + "_" + Math.floor(Math.random() * 1000000),
        email: email,
        profileName: String((req.body && req.body.profileName) || "").trim(),
        passwordHash: hashText(password),
        pinHash: pin ? hashText(pin) : "",
        createdAt: now,
        updatedAt: now,
        data: createDefaultUserData(email)
      };
      db.users.push(user);

      const token = createToken();
      db.sessions.push({
        token: token,
        userId: user.id,
        createdAt: now,
        lastSeenAt: now
      });

      return {
        token: token,
        user: sanitizeUser(user),
        data: user.data
      };
    });

    if (result.error) {
      res.status(409).json({ message: result.error });
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async function (req, res, next) {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const password = String((req.body && req.body.password) || "").trim();

    if (USE_MONGODB) {
      const usersCollection = getMongoCollection(USERS_COLLECTION_NAME);
      const sessionsCollection = getMongoCollection(SESSIONS_COLLECTION_NAME);
      const user = await usersCollection.findOne({ email: email });

      if (!user || user.passwordHash !== hashText(password)) {
        res.status(401).json({ message: "Invalid email or password." });
        return;
      }

      const token = createToken();
      const now = new Date().toISOString();
      await sessionsCollection.insertOne({
        token: token,
        userId: user.id,
        createdAt: now,
        lastSeenAt: now
      });

      res.json({
        token: token,
        user: sanitizeUser(user),
        data: user.data
      });
      return;
    }

    const result = withDb(function (db) {
      const user = db.users.find(function (item) {
        return item.email === email;
      });

      if (!user || user.passwordHash !== hashText(password)) {
        return { error: "Invalid email or password." };
      }

      const token = createToken();
      const now = new Date().toISOString();
      db.sessions.push({
        token: token,
        userId: user.id,
        createdAt: now,
        lastSeenAt: now
      });

      return {
        token: token,
        user: sanitizeUser(user),
        data: user.data
      };
    });

    if (result.error) {
      res.status(401).json({ message: result.error });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", requireAuth, async function (req, res, next) {
  try {
    if (USE_MONGODB) {
      const sessionsCollection = getMongoCollection(SESSIONS_COLLECTION_NAME);
      await sessionsCollection.deleteOne({ token: req.sessionToken });
    } else {
      withDb(function (db) {
        db.sessions = db.sessions.filter(function (session) {
          return session.token !== req.sessionToken;
        });
        return null;
      });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/change-password", requireAuth, async function (req, res, next) {
  try {
    const currentPassword = String((req.body && req.body.currentPassword) || "").trim();
    const newPassword = String((req.body && req.body.newPassword) || "").trim();

    if (!currentPassword) {
      res.status(400).json({ message: "Current password is required." });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: "New password must be at least 6 characters." });
      return;
    }

    const nextPasswordHash = hashText(newPassword);

    if (USE_MONGODB) {
      const usersCollection = getMongoCollection(USERS_COLLECTION_NAME);
      const sessionsCollection = getMongoCollection(SESSIONS_COLLECTION_NAME);
      const user = await usersCollection.findOne({ id: req.authUser.id });

      if (!user) {
        res.status(404).json({ message: "User not found." });
        return;
      }
      if (user.passwordHash !== hashText(currentPassword)) {
        res.status(401).json({ message: "Current password is incorrect." });
        return;
      }
      if (user.passwordHash === nextPasswordHash) {
        res.status(400).json({ message: "New password must be different from current password." });
        return;
      }

      const now = new Date().toISOString();
      await usersCollection.updateOne(
        { id: user.id },
        {
          $set: {
            passwordHash: nextPasswordHash,
            updatedAt: now,
            resetPasswordHash: "",
            resetPasswordExpiresAt: ""
          }
        }
      );

      await sessionsCollection.deleteMany({
        userId: user.id,
        token: { $ne: req.sessionToken }
      });

      res.json({
        ok: true,
        message: "Password changed successfully."
      });
      return;
    }

    const result = withDb(function (db) {
      const user = db.users.find(function (item) {
        return item.id === req.authUser.id;
      });
      if (!user) {
        return { notFound: true };
      }
      if (user.passwordHash !== hashText(currentPassword)) {
        return { invalidCurrentPassword: true };
      }
      if (user.passwordHash === nextPasswordHash) {
        return { samePassword: true };
      }

      user.passwordHash = nextPasswordHash;
      user.updatedAt = new Date().toISOString();
      user.resetPasswordHash = "";
      user.resetPasswordExpiresAt = "";

      db.sessions = db.sessions.filter(function (session) {
        return !(session.userId === user.id && session.token !== req.sessionToken);
      });

      return { ok: true };
    });

    if (result.notFound) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    if (result.invalidCurrentPassword) {
      res.status(401).json({ message: "Current password is incorrect." });
      return;
    }
    if (result.samePassword) {
      res.status(400).json({ message: "New password must be different from current password." });
      return;
    }

    res.json({
      ok: true,
      message: "Password changed successfully."
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/forgot-password/request", async function (req, res, next) {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    if (!isValidEmail(email)) {
      res.status(400).json({ message: "A valid email is required." });
      return;
    }

    const genericMessage = "If an account exists for this email, a reset code has been generated.";

    if (USE_MONGODB) {
      const usersCollection = getMongoCollection(USERS_COLLECTION_NAME);
      const user = await usersCollection.findOne({ email: email });
      if (!user) {
        res.json({ ok: true, message: genericMessage });
        return;
      }

      const resetCode = createResetCode();
      const expiresAt = createResetCodeExpiryIso();
      await usersCollection.updateOne(
        { id: user.id },
        {
          $set: {
            resetPasswordHash: hashText(resetCode),
            resetPasswordExpiresAt: expiresAt,
            updatedAt: new Date().toISOString()
          }
        }
      );

      res.json({
        ok: true,
        message: "Reset code generated. Use this code to set a new password.",
        resetCode: resetCode,
        expiresAt: expiresAt
      });
      return;
    }

    const result = withDb(function (db) {
      const user = db.users.find(function (item) {
        return item.email === email;
      });
      if (!user) {
        return { user: null };
      }

      const resetCode = createResetCode();
      const expiresAt = createResetCodeExpiryIso();
      user.resetPasswordHash = hashText(resetCode);
      user.resetPasswordExpiresAt = expiresAt;
      user.updatedAt = new Date().toISOString();

      return {
        user: user,
        resetCode: resetCode,
        expiresAt: expiresAt
      };
    });

    if (!result.user) {
      res.json({ ok: true, message: genericMessage });
      return;
    }

    res.json({
      ok: true,
      message: "Reset code generated. Use this code to set a new password.",
      resetCode: result.resetCode,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/forgot-password/confirm", async function (req, res, next) {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const code = String((req.body && req.body.code) || "").trim();
    const newPassword = String((req.body && req.body.newPassword) || "").trim();

    if (!isValidEmail(email)) {
      res.status(400).json({ message: "A valid email is required." });
      return;
    }
    if (!code) {
      res.status(400).json({ message: "Reset code is required." });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: "New password must be at least 6 characters." });
      return;
    }

    const nextPasswordHash = hashText(newPassword);
    const invalidCodeMessage = "Reset code is invalid or expired.";

    if (USE_MONGODB) {
      const usersCollection = getMongoCollection(USERS_COLLECTION_NAME);
      const sessionsCollection = getMongoCollection(SESSIONS_COLLECTION_NAME);
      const user = await usersCollection.findOne({ email: email });

      if (!user || !user.resetPasswordHash || !user.resetPasswordExpiresAt) {
        res.status(400).json({ message: invalidCodeMessage });
        return;
      }
      if (isExpiredIsoDate(user.resetPasswordExpiresAt)) {
        res.status(400).json({ message: invalidCodeMessage });
        return;
      }
      if (user.resetPasswordHash !== hashText(code)) {
        res.status(400).json({ message: invalidCodeMessage });
        return;
      }
      if (user.passwordHash === nextPasswordHash) {
        res.status(400).json({ message: "New password must be different from current password." });
        return;
      }

      const now = new Date().toISOString();
      await usersCollection.updateOne(
        { id: user.id },
        {
          $set: {
            passwordHash: nextPasswordHash,
            updatedAt: now,
            resetPasswordHash: "",
            resetPasswordExpiresAt: ""
          }
        }
      );
      await sessionsCollection.deleteMany({ userId: user.id });

      res.json({
        ok: true,
        message: "Password reset successful. Please login with your new password."
      });
      return;
    }

    const result = withDb(function (db) {
      const user = db.users.find(function (item) {
        return item.email === email;
      });
      if (!user || !user.resetPasswordHash || !user.resetPasswordExpiresAt) {
        return { invalidCode: true };
      }
      if (isExpiredIsoDate(user.resetPasswordExpiresAt)) {
        return { invalidCode: true };
      }
      if (user.resetPasswordHash !== hashText(code)) {
        return { invalidCode: true };
      }
      if (user.passwordHash === nextPasswordHash) {
        return { samePassword: true };
      }

      user.passwordHash = nextPasswordHash;
      user.updatedAt = new Date().toISOString();
      user.resetPasswordHash = "";
      user.resetPasswordExpiresAt = "";

      db.sessions = db.sessions.filter(function (session) {
        return session.userId !== user.id;
      });

      return { ok: true };
    });

    if (result.invalidCode) {
      res.status(400).json({ message: invalidCodeMessage });
      return;
    }
    if (result.samePassword) {
      res.status(400).json({ message: "New password must be different from current password." });
      return;
    }

    res.json({
      ok: true,
      message: "Password reset successful. Please login with your new password."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/user", requireAuth, function (req, res) {
  res.json({
    user: sanitizeUser(req.authUser),
    data: req.authUser.data || createDefaultUserData(req.authUser.email)
  });
});

app.put("/api/user", requireAuth, async function (req, res, next) {
  try {
    const incomingData = req.body && req.body.data;
    if (!incomingData || typeof incomingData !== "object") {
      res.status(400).json({ message: "Request body must include a data object." });
      return;
    }
    const hasEmailField = Boolean(req.body && Object.prototype.hasOwnProperty.call(req.body, "email"));
    const hasProfileNameField = Boolean(req.body && Object.prototype.hasOwnProperty.call(req.body, "profileName"));
    const nextEmail = hasEmailField ? normalizeEmail(req.body && req.body.email) : "";
    const nextProfileName = hasProfileNameField
      ? String((req.body && req.body.profileName) || "").trim()
      : "";

    if (hasEmailField && !isValidEmail(nextEmail)) {
      res.status(400).json({ message: "A valid email is required." });
      return;
    }
    if (hasEmailField) {
      incomingData.email = nextEmail;
    }
    if (hasProfileNameField) {
      incomingData.profileName = nextProfileName;
    }

    if (USE_MONGODB) {
      const usersCollection = getMongoCollection(USERS_COLLECTION_NAME);
      const sessionsCollection = getMongoCollection(SESSIONS_COLLECTION_NAME);
      const now = new Date().toISOString();
      const setPayload = {
        data: incomingData,
        updatedAt: now
      };
      if (hasEmailField) {
        setPayload.email = nextEmail;
      }
      if (hasProfileNameField) {
        setPayload.profileName = nextProfileName;
      }

      let updateResult = null;
      try {
        updateResult = await usersCollection.updateOne(
          { id: req.authUser.id },
          {
            $set: setPayload
          }
        );
      } catch (error) {
        if (isMongoDuplicateKeyError(error)) {
          res.status(409).json({ message: "An account with this email already exists." });
          return;
        }
        throw error;
      }

      if (!updateResult.matchedCount) {
        res.status(404).json({ message: "User not found." });
        return;
      }

      await sessionsCollection.updateOne(
        { token: req.sessionToken },
        {
          $set: {
            lastSeenAt: now
          }
        }
      );

      const user = await usersCollection.findOne({ id: req.authUser.id });
      res.json({
        user: sanitizeUser(user),
        data: user && user.data ? user.data : incomingData
      });
      return;
    }

    const updated = withDb(function (db) {
      const user = db.users.find(function (item) {
        return item.id === req.authUser.id;
      });
      if (!user) {
        return null;
      }
      if (hasEmailField && nextEmail !== user.email) {
        const exists = db.users.some(function (item) {
          return item.id !== user.id && item.email === nextEmail;
        });
        if (exists) {
          return { error: "An account with this email already exists." };
        }
        user.email = nextEmail;
      }
      if (hasProfileNameField) {
        user.profileName = nextProfileName;
      }
      user.data = incomingData;
      user.updatedAt = new Date().toISOString();

      db.sessions.forEach(function (session) {
        if (session.token === req.sessionToken) {
          session.lastSeenAt = new Date().toISOString();
        }
      });

      return {
        user: sanitizeUser(user),
        data: user.data
      };
    });

    if (!updated) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    if (updated.error) {
      res.status(409).json({ message: updated.error });
      return;
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.post("/api/transactions/import/pdf", upload.single("statement"), async function (req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ message: "Please attach a PDF in form field 'statement'." });
      return;
    }

    const password = String((req.body && req.body.password) || "").trim();
    const text = await extractPdfTextWithPassword(req.file.buffer, password);
    const extracted = extractTransactionsFromPdfText(text);

    res.json({
      count: extracted.length,
      transactions: extracted,
      parser: "regex-v1"
    });
  } catch (error) {
    if (error && error.code === "PDF_PASSWORD_REQUIRED") {
      res.status(422).json({
        message: "This PDF is password protected. Provide the PDF password and retry.",
        code: error.code
      });
      return;
    }
    if (error && error.code === "PDF_PASSWORD_INVALID") {
      res.status(422).json({
        message: "Incorrect PDF password. Please retry.",
        code: error.code
      });
      return;
    }
    res.status(500).json({
      message: "Could not parse the PDF statement.",
      code: "PDF_PARSE_FAILED",
      details: error.message
    });
  }
});

app.post("/api/transactions/export/csv", function (req, res) {
  const transactions = Array.isArray(req.body && req.body.transactions)
    ? req.body.transactions
    : [];

  if (transactions.length === 0) {
    res.status(400).json({ message: "No transactions provided for CSV export." });
    return;
  }

  const passwordResult = normalizeExportPassword(req.body && req.body.password);
  if (passwordResult.error) {
    res.status(400).json({ message: passwordResult.error, code: "EXPORT_PASSWORD_REQUIRED" });
    return;
  }

  const csvText = buildCsvText(transactions);
  const encryptedBuffer = buildEncryptedCsvBuffer(csvText, passwordResult.value);
  const fileName = "transactions_" + new Date().toISOString().slice(0, 10) + ".csv.enc";

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", 'attachment; filename="' + fileName + '"');
  res.send(encryptedBuffer);
});

app.post("/api/reports/export/summary/pdf", function (req, res) {
  const passwordResult = normalizeExportPassword(req.body && req.body.password);
  if (passwordResult.error) {
    res.status(400).json({ message: passwordResult.error, code: "EXPORT_PASSWORD_REQUIRED" });
    return;
  }

  const month = String((req.body && req.body.month) || "").trim() || new Date().toISOString().slice(0, 7);
  const income = Number((req.body && req.body.income) || 0);
  const expense = Number((req.body && req.body.expense) || 0);
  const balance = Number((req.body && req.body.balance) || (income - expense));
  const insights = Array.isArray(req.body && req.body.insights) ? req.body.insights : [];

  const safeIncome = Number.isFinite(income) ? income : 0;
  const safeExpense = Number.isFinite(expense) ? expense : 0;
  const safeBalance = Number.isFinite(balance) ? balance : safeIncome - safeExpense;
  const currency = String((req.body && req.body.currency) || "INR");

  const doc = new PDFDocument(buildPdfDocOptions(passwordResult.value));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="finance_summary_' + month + '.pdf"');
  doc.pipe(res);

  doc.fontSize(16).fillColor("#111").text("Finance Tracker Summary");
  doc.moveDown(0.6);
  doc.fontSize(10).fillColor("#555");
  doc.text("Month: " + month);
  doc.text("Income: " + formatCurrency(safeIncome, currency));
  doc.text("Expense: " + formatCurrency(safeExpense, currency));
  doc.text("Net: " + formatCurrency(safeBalance, currency));
  doc.moveDown(0.8);

  doc.fontSize(12).fillColor("#111").text("Top Insights");
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#333");
  if (insights.length === 0) {
    doc.text("- No insights yet.");
  } else {
    insights.slice(0, 8).forEach(function (insight, index) {
      const line = safeText((index + 1) + ". " + String(insight || ""));
      doc.text(line);
    });
  }

  doc.end();
});

app.post("/api/transactions/export/pdf", function (req, res) {
  const transactions = Array.isArray(req.body && req.body.transactions)
    ? req.body.transactions
    : [];

  if (transactions.length === 0) {
    res.status(400).json({ message: "No transactions provided for PDF export." });
    return;
  }

  const passwordResult = normalizeExportPassword(req.body && req.body.password);
  if (passwordResult.error) {
    res.status(400).json({ message: passwordResult.error, code: "EXPORT_PASSWORD_REQUIRED" });
    return;
  }

  const title = String((req.body && req.body.title) || "NexSpend Transactions Export");
  const currency = String((req.body && req.body.currency) || "INR");

  const doc = new PDFDocument(buildPdfDocOptions(passwordResult.value));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=transactions_export.pdf");
  doc.pipe(res);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;

  doc.fontSize(16).text(title, { width: pageWidth });
  y = doc.y + 2;
  doc.fontSize(10).fillColor("#555");
  doc.text("Generated: " + new Date().toLocaleString(), { width: pageWidth });
  y = doc.y + 10;

  doc.fillColor("#111").fontSize(11).text("Transactions: " + transactions.length, doc.page.margins.left, y);
  y = doc.y + 12;

  transactions.forEach(function (transaction, index) {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    const line = [
      String(index + 1) + ".",
      safeText(transaction.date || "-"),
      safeText(transaction.type || "-"),
      formatCurrency(transaction.amount, currency),
      safeText(transaction.category || "Uncategorized"),
      safeText(transaction.account || "Unknown")
    ].join("  |  ");

    doc.fontSize(9).fillColor("#111").text(line, doc.page.margins.left, y, {
      width: pageWidth
    });
    y = doc.y + 2;

    const notes = safeText(transaction.notes || "-");
    doc.fontSize(8).fillColor("#555").text("Notes: " + notes, doc.page.margins.left + 8, y, {
      width: pageWidth - 8
    });
    y = doc.y + 6;

    const tagText = Array.isArray(transaction.tags)
      ? transaction.tags.join(", ")
      : String(transaction.tags || "").trim();
    if (tagText) {
      doc.fontSize(8).fillColor("#666").text("Tags: " + tagText, doc.page.margins.left + 8, y, {
        width: pageWidth - 8
      });
      y = doc.y + 8;
    }

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor("#ddd").stroke();
    y += 8;
  });

  doc.end();
});

app.use(express.static(FRONTEND_DIR));

app.get("/", function (_req, res) {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.get("*", function (req, res, next) {
  if (String(req.path || "").startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.use(function (err, _req, res, _next) {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ message: "File is too large. Max size is 12MB." });
    return;
  }
  res.status(500).json({ message: "Unexpected server error.", details: err ? err.message : "" });
});

async function startServer() {
  try {
    const storageMode = await initializeStorage();
    app.listen(PORT, function () {
      // eslint-disable-next-line no-console
      console.log("NexSpend backend running on http://localhost:" + PORT);
      // eslint-disable-next-line no-console
      console.log(
        storageMode === "mongo"
          ? "Storage: MongoDB (" + MONGODB_DB_NAME + ")"
          : "Storage: Local file (" + DB_PATH + ")"
      );
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", error && error.message ? error.message : error);
    process.exit(1);
  }
}

startServer();


