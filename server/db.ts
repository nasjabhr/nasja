import fs from "fs";
import path from "path";

// Master account UID - strictly kept server-side to protect founder data privacy
export const MASTER_USER_UID = process.env.MASTER_USER_UID || "0843d2d4-0702-4ecf-800b-956155367d0a";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "database.json");
const SETTINGS_FILE = path.join(DB_DIR, "store_settings.json");

export interface StoreSettings {
  whatsappNumber: string;
  storeName: string;
  storeTagline: string;
  announcementText: string;
  instagramHandle: string;
  defaultThobeMeters: number;
  hideOutOfStock: boolean;
  defaultSeason: 'all' | 'summer' | 'winter' | 'spring';
  headerVisible: boolean;
  seasonsOrder: ('winter' | 'summer' | 'spring')[];
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  whatsappNumber: "38244795",
  storeName: "نَسْجَة",
  storeTagline: "أقمشة رجالية فاخرة ومختارة بعناية",
  announcementText: "أرقى خامات الأقمشة الرجالية المختارة بعناية فائقة • متوفرة بالقطعة وطاقة القماش",
  instagramHandle: "nasjah.bh",
  defaultThobeMeters: 3.5,
  hideOutOfStock: false,
  defaultSeason: "all",
  headerVisible: true,
  seasonsOrder: ['winter', 'summer', 'spring'],
};

export interface UserStoreData {
  orders: any[];
  expenses: any[];
  inventory: any[];
  customProfits?: any[];
  settings?: StoreSettings;
  lastUpdated: number;
}

export interface DatabaseSchema {
  version: number;
  users: Record<string, UserStoreData>;
}

const DEFAULT_INVENTORY: any[] = [];

function ensureDirectoryExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readDatabase(): DatabaseSchema {
  ensureDirectoryExists();
  if (!fs.existsSync(DB_FILE)) {
    const initialDb: DatabaseSchema = {
      version: 1,
      users: {
        [MASTER_USER_UID]: {
          orders: [],
          expenses: [],
          inventory: DEFAULT_INVENTORY,
          lastUpdated: Date.now()
        }
      }
    };
    writeDatabase(initialDb);
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = {};
    if (!parsed.users[MASTER_USER_UID]) {
      parsed.users[MASTER_USER_UID] = {
        orders: [],
        expenses: [],
        inventory: DEFAULT_INVENTORY,
        lastUpdated: Date.now()
      };
      writeDatabase(parsed);
    }
    return parsed;
  } catch (err) {
    console.error("Error reading database file, recovering:", err);
    const fallbackDb: DatabaseSchema = {
      version: 1,
      users: {
        [MASTER_USER_UID]: {
          orders: [],
          expenses: [],
          inventory: DEFAULT_INVENTORY,
          lastUpdated: Date.now()
        }
      }
    };
    writeDatabase(fallbackDb);
    return fallbackDb;
  }
}

function writeDatabase(db: DatabaseSchema): void {
  ensureDirectoryExists();
  const tmpFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    // If atomic rename fails, fallback to direct write
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  }
}

export function getUserData(): { orders: any[]; expenses: any[]; inventory: any[]; customProfits: any[]; settings: StoreSettings; capital: number } {
  const db = readDatabase();
  const userData = db.users[MASTER_USER_UID] || {
    orders: [],
    expenses: [],
    inventory: [],
    customProfits: [],
    lastUpdated: Date.now()
  };

  // Strictly sanitize: NEVER leak MASTER_USER_UID or internal DB metadata to the response
  return {
    orders: userData.orders || [],
    expenses: userData.expenses || [],
    inventory: userData.inventory || [],
    customProfits: userData.customProfits || [],
    settings: getStoreSettings(),
    capital: (userData as any).capital || 0
  };
}

export function syncUserData(payload: {
  orders?: any[];
  expenses?: any[];
  inventory?: any[];
  customProfits?: any[];
  settings?: any;
  capital?: number;
}): { success: boolean; totalOrders: number; totalExpenses: number; totalInventory: number; totalCustomProfits: number } {
  const db = readDatabase();
  const current = db.users[MASTER_USER_UID] || {
    orders: [],
    expenses: [],
    inventory: DEFAULT_INVENTORY,
    customProfits: [],
    lastUpdated: Date.now()
  };

  if (Array.isArray(payload.orders)) {
    current.orders = payload.orders;
  }
  if (Array.isArray(payload.expenses)) {
    current.expenses = payload.expenses;
  }
  if (Array.isArray(payload.inventory)) {
    current.inventory = payload.inventory;
  }
  if (Array.isArray(payload.customProfits)) {
    current.customProfits = payload.customProfits;
  }
  if (typeof payload.capital === 'number') {
    (current as any).capital = payload.capital;
  }
  if (payload.settings && typeof payload.settings === 'object') {
    saveStoreSettings(payload.settings);
  }
  current.lastUpdated = Date.now();

  db.users[MASTER_USER_UID] = current;
  writeDatabase(db);

  return {
    success: true,
    totalOrders: current.orders.length,
    totalExpenses: current.expenses.length,
    totalInventory: current.inventory.length,
    totalCustomProfits: (current.customProfits || []).length
  };
}

export function saveOrder(order: any): any {
  const db = readDatabase();
  const current = db.users[MASTER_USER_UID];
  const list = current.orders || [];

  const existingIndex = list.findIndex((o) => o.id === order.id);
  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], ...order };
  } else {
    list.unshift(order);
  }

  current.orders = list;
  current.lastUpdated = Date.now();
  db.users[MASTER_USER_UID] = current;
  writeDatabase(db);
  return order;
}

export function deleteOrder(orderId: string): boolean {
  const db = readDatabase();
  const current = db.users[MASTER_USER_UID];
  const list = current.orders || [];
  current.orders = list.filter((o) => o.id !== orderId);
  current.lastUpdated = Date.now();
  db.users[MASTER_USER_UID] = current;
  writeDatabase(db);
  return true;
}

export function saveExpense(expense: any): any {
  const db = readDatabase();
  const current = db.users[MASTER_USER_UID];
  const list = current.expenses || [];

  const existingIndex = list.findIndex((e) => e.id === expense.id);
  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], ...expense };
  } else {
    list.unshift(expense);
  }

  current.expenses = list;
  current.lastUpdated = Date.now();
  db.users[MASTER_USER_UID] = current;
  writeDatabase(db);
  return expense;
}

export function deleteExpense(expenseId: string): boolean {
  const db = readDatabase();
  const current = db.users[MASTER_USER_UID];
  const list = current.expenses || [];
  current.expenses = list.filter((e) => e.id !== expenseId);
  current.lastUpdated = Date.now();
  db.users[MASTER_USER_UID] = current;
  writeDatabase(db);
  return true;
}

export function saveInventoryItem(item: any): any {
  const db = readDatabase();
  const current = db.users[MASTER_USER_UID];
  const list = current.inventory || [];

  const existingIndex = list.findIndex((f) => f.id === item.id);
  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], ...item };
  } else {
    list.unshift(item);
  }

  current.inventory = list;
  current.lastUpdated = Date.now();
  db.users[MASTER_USER_UID] = current;
  writeDatabase(db);
  return item;
}

export function deleteInventoryItem(itemId: string): boolean {
  const db = readDatabase();
  const current = db.users[MASTER_USER_UID];
  const list = current.inventory || [];
  current.inventory = list.filter((f) => f.id !== itemId);
  current.lastUpdated = Date.now();
  db.users[MASTER_USER_UID] = current;
  writeDatabase(db);
  return true;
}

export function resetStoreData(): boolean {
  const db = readDatabase();
  db.users[MASTER_USER_UID] = {
    orders: [],
    expenses: [],
    inventory: DEFAULT_INVENTORY,
    settings: DEFAULT_STORE_SETTINGS,
    lastUpdated: Date.now()
  };
  writeDatabase(db);
  return true;
}

export function getStoreSettings(): StoreSettings {
  // 1. Try dedicated store_settings.json file
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_STORE_SETTINGS,
          ...parsed
        };
      }
    }
  } catch {}

  // 2. Try database.json
  const db = readDatabase();
  const current = db.users[MASTER_USER_UID];
  return {
    ...DEFAULT_STORE_SETTINGS,
    ...(current?.settings || {})
  };
}

export function saveStoreSettings(settings: Partial<StoreSettings>): StoreSettings {
  const current = getStoreSettings();
  const merged: StoreSettings = {
    ...current,
    ...settings
  };

  // 1. Write to dedicated store_settings.json
  try {
    ensureDirectoryExists();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.warn("Error writing store_settings.json:", err);
  }

  // 2. Write to database.json
  try {
    const db = readDatabase();
    const user = db.users[MASTER_USER_UID] || {
      orders: [],
      expenses: [],
      inventory: [],
      settings: merged,
      lastUpdated: Date.now()
    };
    user.settings = merged;
    user.lastUpdated = Date.now();
    db.users[MASTER_USER_UID] = user;
    writeDatabase(db);
  } catch (err) {
    console.warn("Error updating user settings in database.json:", err);
  }

  return merged;
}

