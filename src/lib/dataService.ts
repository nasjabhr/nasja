/**
 * Nasjah data layer (browser side) — thin client for the hardened backend (/api/admin, /api/store).
 *
 * Guarantees:
 *   - The database (through the backend) is the ONLY source of truth. Business data is never cached in
 *     localStorage/sessionStorage, so a page reload always shows exactly what is saved in the database.
 *   - Every write goes to the backend; the UI is updated optimistically and then replaced with the
 *     server's authoritative state. Failures are surfaced (never silently swallowed) and rolled back.
 *   - Writes are sent as diffs (changed + removed ids) so one device can never wipe another device's records.
 */
import { Fabric, Order, Expense, CustomProfit, StoreSettings, DEFAULT_STORE_SETTINGS } from '../types';
import { supabase } from './supabase';

export const EVENT_DATA_UPDATED = 'nasjah_store_data_updated';
export const EVENT_STORE_SETTINGS_UPDATED = 'nasjah_store_settings_updated';
export const EVENT_SYNC_STATUS = 'nasjah_sync_status';

export interface StoreData {
  orders: Order[];
  expenses: Expense[];
  inventory: Fabric[];
  capital?: number;
  customProfits?: CustomProfit[];
  settings?: StoreSettings;
}

export interface SyncStatus {
  mode: 'unknown' | 'service' | 'user-jwt';
  lastError: string | null;
  lastErrorAt: number;
  lastSyncAt: number;
  pendingWrites: number;
}

type Entity = 'orders' | 'expenses' | 'inventory' | 'customProfits';

// ---------------------------------------------------------------------------
// Legacy browser-storage cleanup (old versions kept stale copies of business data here)
// ---------------------------------------------------------------------------
const LEGACY_DATA_KEY = 'nasjah_store_data';
const LEGACY_DELETED_EXPENSES_KEY = 'nasjah_deleted_expense_ids';
const LEGACY_KEYS_ALWAYS_REMOVE = ['nasjah_store_data_updated', 'nasjah_store_settings', 'nasjah_store_settings_time'];
const LEGACY_PREFIXES = ['nasjah_offline_store_v', 'nasjah_cached_'];

function purgeLegacyCaches(includeDataKeys: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const remove: string[] = [...LEGACY_KEYS_ALWAYS_REMOVE];
    if (includeDataKeys) remove.push(LEGACY_DATA_KEY, LEGACY_DELETED_EXPENSES_KEY);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && LEGACY_PREFIXES.some((p) => k.startsWith(p))) remove.push(k);
    }
    remove.forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}
purgeLegacyCaches(false);

function readLegacyPayload(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEGACY_DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    let deletedExpenseIds: string[] = [];
    try {
      deletedExpenseIds = JSON.parse(localStorage.getItem(LEGACY_DELETED_EXPENSES_KEY) || '[]');
    } catch { /* ignore */ }
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      customProfits: Array.isArray(parsed.customProfits) ? parsed.customProfits : [],
      capital: typeof parsed.capital === 'number' ? parsed.capital : 0,
      deletedExpenseIds: Array.isArray(deletedExpenseIds) ? deletedExpenseIds : [],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-memory state (lives only for the lifetime of the page)
// ---------------------------------------------------------------------------
const emptyStore = (): StoreData => ({
  orders: [],
  expenses: [],
  inventory: [],
  capital: 0,
  customProfits: [],
  settings: { ...DEFAULT_STORE_SETTINGS },
});

let store: StoreData = emptyStore();
let ready = false;
const status: SyncStatus = { mode: 'unknown', lastError: null, lastErrorAt: 0, lastSyncAt: 0, pendingWrites: 0 };

function emitStatus() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_SYNC_STATUS, { detail: { ...status } }));
  }
}

export function getSyncStatus(): SyncStatus {
  return { ...status };
}

export function notifyDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT_DATA_UPDATED));
  }
}

function notifySettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_STORE_SETTINGS_UPDATED, { detail: store.settings }));
  }
}

function reportError(context: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err || 'خطأ غير معروف');
  status.lastError = `${context}: ${msg}`;
  status.lastErrorAt = Date.now();
  console.error('[nasjah]', status.lastError);
  emitStatus();
}

function applyServerState(payload: any) {
  const d = payload?.data || {};
  store = {
    orders: Array.isArray(d.orders) ? d.orders : [],
    expenses: Array.isArray(d.expenses) ? d.expenses : [],
    inventory: Array.isArray(d.inventory) ? d.inventory : [],
    capital: Number(d.capital) || 0,
    customProfits: Array.isArray(d.customProfits) ? d.customProfits : [],
    settings: { ...DEFAULT_STORE_SETTINGS, ...(d.settings || {}) },
  };
  ready = true;
  status.mode = payload?.mode === 'service' ? 'service' : payload?.mode === 'user-jwt' ? 'user-jwt' : status.mode;
  status.lastSyncAt = Date.now();
  status.lastError = null;
  notifyDataChanged();
  notifySettings();
  emitStatus();
}

// ---------------------------------------------------------------------------
// Backend client
// ---------------------------------------------------------------------------
class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function accessToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    if (data?.session?.access_token) return data.session.access_token;
  }
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new ApiError('انتهت الجلسة، يرجى تسجيل الدخول مجدداً', 401);
  return token;
}

async function callAdmin(method: 'GET' | 'POST', body?: unknown, retried = false): Promise<any> {
  const token = await accessToken(retried);
  let res: Response;
  try {
    res = await fetch('/api/admin', {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('تعذر الاتصال بالخادم، تحقق من الإنترنت', 0);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new ApiError(`الخادم الخلفي غير متاح (HTTP ${res.status})`, res.status);
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && !retried) return callAdmin(method, body, true);
  if (!res.ok || !json?.ok) {
    const detail = json?.detail ? ` — ${json.detail}` : '';
    throw new ApiError(`${json?.error || `خطأ ${res.status}`}${detail}`, res.status);
  }
  return json;
}

// Sequential write queue: preserves ordering of rapid edits and lets reads wait for pending writes.
let writeChain: Promise<unknown> = Promise.resolve();
function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  status.pendingWrites += 1;
  emitStatus();
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run.finally(() => {
    status.pendingWrites = Math.max(0, status.pendingWrites - 1);
    emitStatus();
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export function getCloudData(): StoreData {
  return store;
}

/** Backward-compatible alias (no local storage involved anymore). */
export const getLocalData = getCloudData;

export function isCloudDataReady(): boolean {
  return ready;
}

let inflightSync: Promise<StoreData> | null = null;
let legacyMigrationDone = false;

/**
 * Loads the latest state from the database through the backend.
 * Always resolves (with the last known state on failure) and reports errors via EVENT_SYNC_STATUS.
 */
export function syncWithServer(_forceFresh = false): Promise<StoreData> {
  if (inflightSync) return inflightSync;
  inflightSync = (async () => {
    try {
      await writeChain; // never let a read overwrite an in-flight write
      startBackgroundRefresh();

      const legacy = legacyMigrationDone ? null : readLegacyPayload();
      if (legacy) {
        const json = await callAdmin('POST', { action: 'migrate', legacy });
        purgeLegacyCaches(true);
        legacyMigrationDone = true;
        applyServerState(json);
      } else {
        legacyMigrationDone = true;
        const json = await callAdmin('GET');
        applyServerState(json);
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) reportError('تعذر تحميل البيانات من قاعدة البيانات', err);
    } finally {
      inflightSync = null;
    }
    return store;
  })();
  return inflightSync;
}

let refreshStarted = false;
/** Keeps every open device in sync (replaces client realtime, which is disabled once RLS is locked down). */
function startBackgroundRefresh() {
  if (refreshStarted || typeof window === 'undefined') return;
  refreshStarted = true;
  const refreshIfVisible = () => {
    if (document.visibilityState === 'visible' && status.pendingWrites === 0) {
      syncWithServer(true).catch(() => {});
    }
  };
  window.addEventListener('focus', refreshIfVisible);
  document.addEventListener('visibilitychange', refreshIfVisible);
  window.setInterval(refreshIfVisible, 20_000);
}

/** Kept for backward compatibility; background refresh is started automatically. */
export function setupRealtimeSubscription() {
  startBackgroundRefresh();
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
const ENTITY_KEY: Record<Entity, keyof StoreData> = {
  orders: 'orders',
  expenses: 'expenses',
  inventory: 'inventory',
  customProfits: 'customProfits',
};
const ENTITY_LABEL: Record<Entity, string> = {
  orders: 'فشل حفظ الطلبات',
  expenses: 'فشل حفظ المصروفات',
  inventory: 'فشل حفظ المخزون',
  customProfits: 'فشل حفظ الإيرادات الإضافية',
};

function persistCollection<T extends { id: string }>(entity: Entity, next: T[]): Promise<void> {
  const key = ENTITY_KEY[entity];
  const prev = ((store[key] as unknown as T[]) || []).slice();
  const prevById = new Map(prev.map((x) => [x.id, JSON.stringify(x)]));
  const nextIds = new Set(next.map((x) => x.id));
  const upsert = next.filter((x) => prevById.get(x.id) !== JSON.stringify(x));
  const remove = prev.filter((x) => !nextIds.has(x.id)).map((x) => x.id);

  // Optimistic UI
  store = { ...store, [key]: next };
  notifyDataChanged();

  if (upsert.length === 0 && remove.length === 0) return Promise.resolve();

  return enqueueWrite(async () => {
    try {
      const json = await callAdmin('POST', { action: 'apply', entity, upsert, delete: remove });
      applyServerState(json);
    } catch (err) {
      reportError(ENTITY_LABEL[entity], err);
      // Roll back to what is really in the database
      try {
        applyServerState(await callAdmin('GET'));
      } catch {
        store = { ...store, [key]: prev };
        notifyDataChanged();
      }
    }
  });
}

export async function persistOrders(orders: Order[]): Promise<void> {
  return persistCollection('orders', orders);
}

export async function deleteOrderPermanently(orderId: string): Promise<Order[]> {
  await persistCollection('orders', store.orders.filter((o) => o.id !== orderId));
  return store.orders;
}

export async function persistExpenses(expenses: Expense[]): Promise<void> {
  return persistCollection('expenses', expenses);
}

export async function deleteExpensePermanently(expenseId: string): Promise<Expense[]> {
  await persistCollection('expenses', store.expenses.filter((e) => e.id !== expenseId));
  return store.expenses;
}

export async function persistInventory(inventory: Fabric[]): Promise<void> {
  return persistCollection('inventory', inventory);
}

export async function deleteFabricPermanently(fabricId: string): Promise<Fabric[]> {
  await persistCollection('inventory', store.inventory.filter((f) => f.id !== fabricId));
  return store.inventory;
}

export async function persistCustomProfits(customProfits: CustomProfit[]): Promise<void> {
  return persistCollection('customProfits', customProfits);
}

export async function addCustomProfit(entry: Omit<CustomProfit, 'id' | 'createdAt'>): Promise<CustomProfit[]> {
  const newEntry: CustomProfit = {
    ...entry,
    id: 'prof_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: Date.now(),
  };
  await persistCollection('customProfits', [newEntry, ...(store.customProfits || [])]);
  return store.customProfits || [];
}

export async function deleteCustomProfitPermanently(profitId: string): Promise<CustomProfit[]> {
  await persistCollection('customProfits', (store.customProfits || []).filter((p) => p.id !== profitId));
  return store.customProfits || [];
}

export async function persistCapital(amount: number): Promise<void> {
  const prev = store.capital || 0;
  store = { ...store, capital: amount };
  notifyDataChanged();
  return enqueueWrite(async () => {
    try {
      applyServerState(await callAdmin('POST', { action: 'capital', amount }));
    } catch (err) {
      reportError('فشل حفظ رأس المال', err);
      store = { ...store, capital: prev };
      notifyDataChanged();
    }
  });
}

/** Deletes ALL orders and expenses in the database (irreversible). */
export async function resetDatabase(): Promise<void> {
  return enqueueWrite(async () => {
    try {
      applyServerState(await callAdmin('POST', { action: 'reset', confirm: 'RESET_ORDERS_AND_EXPENSES' }));
    } catch (err) {
      reportError('فشل حذف البيانات', err);
      throw err;
    }
  });
}

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------
export function getLocalStoreSettings(): StoreSettings {
  return store.settings || { ...DEFAULT_STORE_SETTINGS };
}

/** Saves store settings in the database. Throws on failure so the settings page can show the error. */
export async function persistStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  return enqueueWrite(async () => {
    try {
      applyServerState(await callAdmin('POST', { action: 'settings', settings }));
      return getLocalStoreSettings();
    } catch (err) {
      reportError('فشل حفظ إعدادات المتجر', err);
      throw err;
    }
  });
}

// ---------------------------------------------------------------------------
// Public storefront (no authentication)
// ---------------------------------------------------------------------------
export interface PublicCatalogItem {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  category: string;
  imageUrl: string;
  season?: string;
  description?: string;
}

export async function fetchPublicStore(): Promise<{ settings: StoreSettings; catalog: PublicCatalogItem[] }> {
  const res = await fetch('/api/store', { cache: 'no-store', headers: { Accept: 'application/json' } });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error(`الخادم غير متاح (HTTP ${res.status})`);
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.error || `خطأ ${res.status}`);
  const settings: StoreSettings = { ...DEFAULT_STORE_SETTINGS, ...(json.settings || {}) };
  store = { ...store, settings };
  notifySettings();
  return { settings, catalog: Array.isArray(json.catalog) ? json.catalog : [] };
}
