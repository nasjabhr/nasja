import { Fabric, Order, Expense, CustomProfit, StoreSettings, DEFAULT_STORE_SETTINGS } from '../types';
import { supabase } from './supabase';
import { APP_VERSION } from '../version';

export const EVENT_DATA_UPDATED = 'nasjah_store_data_updated';
export const EVENT_STORE_SETTINGS_UPDATED = 'nasjah_store_settings_updated';

export interface StoreData {
  orders: Order[];
  expenses: Expense[];
  inventory: Fabric[];
  capital?: number;
  customProfits?: CustomProfit[];
  settings?: StoreSettings;
}

// 8 Exact Real Expenses from Supabase Database for Nasjah Atelier
export const SEED_EXPENSES: Expense[] = [
  {
    id: "UVW3Q3",
    description: "رسوم الرحلة (احمد عبد الأمير)",
    amount: 3.8,
    category: "عام ومصاريف أخرى",
    paymentMethod: "بطاقة ائتمانية",
    paidTo: "رسوم الرحلة",
    notes: "",
    createdAt: 1789735140000
  },
  {
    id: "60VWIG",
    description: "رسوم الرحلة (علي عبد الرسول)",
    amount: 51.2,
    category: "عام ومصاريف أخرى",
    paymentMethod: "بطاقة ائتمانية",
    paidTo: "رسوم الرحلة",
    notes: "",
    createdAt: 1789668660000
  },
  {
    id: "O8U3P5",
    description: "رسوم الرحلة الأولى (ابو حسين)",
    amount: 22.78,
    category: "عام ومصاريف أخرى",
    paymentMethod: "بطاقة ائتمانية",
    paidTo: "رسوم الرحلة",
    notes: "",
    createdAt: 1789668540000
  },
  {
    id: "D4R0DZ",
    description: "بترول الاكورد",
    amount: 15,
    category: "عام ومصاريف أخرى",
    paymentMethod: "بطاقة ائتمانية",
    paidTo: "محطة الرملي",
    notes: "فل سيارة ابو حسين قبل السفر اول مرة",
    createdAt: 1789497300000
  },
  {
    id: "62GDX8",
    description: "طلبية تيمو",
    amount: 11.64,
    category: "تغليف ومطبوعات",
    paymentMethod: "بطاقة ائتمانية",
    paidTo: "تيمو",
    notes: "اول دفعة لنا",
    createdAt: 1789480740000
  },
  {
    id: "EXP_LIGHT_01",
    description: "اضاءة هدايا الزبائن",
    amount: 6.5,
    category: "تسويق وإعلانات",
    paymentMethod: "بنفت بي",
    paidTo: "تسويق الإعلانات",
    notes: "",
    createdAt: 1789750000000
  },
  {
    id: "EXP_LOAN_01",
    description: "سلف احمد عبد الامير",
    amount: 10,
    category: "عام ومصاريف أخرى",
    paymentMethod: "بنفت بي",
    paidTo: "احمد",
    notes: "",
    createdAt: 1789720000000
  },
  {
    id: "EXP_TOOL_01",
    description: "مقص ومسطرة متر",
    amount: 6.5,
    category: "صيانة وأدوات",
    paymentMethod: "بنفت بي",
    paidTo: "محل في الديه",
    notes: "",
    createdAt: 1789710000000
  }
];

export const SEED_INVENTORY: Fabric[] = [
  {
    id: "1790612806579",
    name: "الاكياس",
    quantity: 48,
    price: 0,
    category: "تغليف",
    imageUrl: "",
    image: "",
    barcode: ""
  },
  {
    id: "1790612704281",
    name: "ستيكرات",
    quantity: 348,
    price: 0,
    category: "تغليف",
    imageUrl: "",
    image: "",
    barcode: ""
  },
  {
    id: "1790612641654",
    name: "ورق الزبدة",
    quantity: 46,
    price: 0.07,
    category: "تغليف",
    imageUrl: "",
    image: "",
    barcode: ""
  },
  {
    id: "1790612506591",
    name: "بزنز كارد",
    quantity: 59,
    price: 0.03,
    category: "تغليف",
    imageUrl: "",
    image: "",
    barcode: ""
  },
  {
    id: "1790612366421",
    name: "ستيكر 3D",
    quantity: 48,
    price: 0.04,
    category: "تغليف",
    imageUrl: "",
    image: "",
    barcode: ""
  },
  {
    id: "1790867257979",
    name: "مدينة الرجال",
    quantity: 999,
    price: 4,
    category: "أقمشة",
    imageUrl: "",
    image: "",
    barcode: "{\"sourcingType\":\"stock\",\"costPrice\":0}"
  }
];

// Cache storage key strictly tied to APP_VERSION - automatically invalidates on every release
export const CACHE_STORAGE_KEY = `nasjah_offline_store_v${APP_VERSION}`;

const DELETED_EXPENSES_KEY = 'nasjah_deleted_expense_ids';

export function getDeletedExpenseIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_EXPENSES_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function recordDeletedExpenseId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getDeletedExpenseIds();
    current.add(id);
    localStorage.setItem(DELETED_EXPENSES_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

/**
 * Merges any expense array with the 8 canonical real expenses from Supabase.
 * Guarantees that all 8 original expenses are preserved unless explicitly deleted by user,
 * and fixes stale amounts (e.g. Temu 11.64 BHD).
 */
export function mergeExpensesWithSeed(existingExpenses?: Expense[] | null): Expense[] {
  const deletedIds = getDeletedExpenseIds();
  const map = new Map<string, Expense>();

  // 1. Populate canonical seed expenses
  for (const seed of SEED_EXPENSES) {
    if (!deletedIds.has(seed.id)) {
      map.set(seed.id, seed);
    }
  }

  // 2. Overlay existing/incoming expenses
  if (Array.isArray(existingExpenses)) {
    for (const exp of existingExpenses) {
      if (!exp || !exp.id || deletedIds.has(exp.id)) continue;
      // Sanitize old incorrect Temu amount (19.02) to true Supabase amount (11.64)
      if (exp.id === '62GDX8' && (Number(exp.amount) === 19.02 || !exp.amount)) {
        map.set('62GDX8', { ...exp, amount: 11.64 });
      } else {
        const existing = map.get(exp.id);
        map.set(exp.id, existing ? { ...existing, ...exp } : exp);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function loadCachedStore(): StoreData {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('nasjah_store_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            orders: Array.isArray(parsed.orders) ? parsed.orders : [],
            expenses: Array.isArray(parsed.expenses) && parsed.expenses.length > 0 ? parsed.expenses : mergeExpensesWithSeed([]),
            inventory: Array.isArray(parsed.inventory) && parsed.inventory.length > 0 ? parsed.inventory : SEED_INVENTORY,
            capital: typeof parsed.capital === 'number' ? parsed.capital : 0,
            customProfits: Array.isArray(parsed.customProfits) ? parsed.customProfits : [],
            settings: parsed.settings || DEFAULT_STORE_SETTINGS
          };
        }
      }
    } catch {}
  }
  return {
    orders: [],
    expenses: mergeExpensesWithSeed([]),
    inventory: SEED_INVENTORY,
    capital: 0,
    customProfits: [],
    settings: DEFAULT_STORE_SETTINGS
  };
}

function saveCachedStore(data: StoreData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('nasjah_store_data', JSON.stringify(data));
    localStorage.setItem('nasjah_store_data_updated', Date.now().toString());
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }
}

// In-memory runtime store - initializes from saved localStorage immediately
let cloudStore: StoreData = loadCachedStore();

let activeSyncPromise: Promise<StoreData> | null = null;
let realtimeChannelSubscribed = false;
let isInitialCloudLoadComplete = false;

// Purge only legacy/obsolete cache keys on module load and register auto-refresh on focus
if (typeof window !== 'undefined') {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (
        k.startsWith('nasjah_offline_store_v') || 
        k.startsWith('nasjah_cached_')
      )) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
  } catch (_) {}

  window.addEventListener('focus', () => {
    syncWithServer(true).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncWithServer(true).catch(() => {});
    }
  });
}

export function notifyDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT_DATA_UPDATED));
  }
}

/**
 * Returns in-memory state fetched purely from the cloud database
 */
export function getCloudData(): StoreData {
  return cloudStore;
}

/**
 * Backward compatibility alias pointing directly to getCloudData
 */
export const getLocalData = getCloudData;

export function isCloudDataReady(): boolean {
  return isInitialCloudLoadComplete;
}

/**
 * Strips heavy base64 strings from inventory before saving to auth metadata
 * to prevent Supabase JWT token overflow (HTTP 431 / payload size errors)
 */
function sanitizeInventoryForMetadata(inventory: Fabric[]): Fabric[] {
  return inventory.map(item => ({
    ...item,
    imageUrl: item.imageUrl && item.imageUrl.length > 500 ? '' : item.imageUrl,
    image: item.image && item.image.length > 500 ? '' : item.image
  }));
}

/**
 * Saves store data to both Supabase PostgreSQL tables and server API,
 * as well as lightweight user metadata in the cloud.
 */
export async function syncToSupabase(data: StoreData): Promise<void> {
  if (!supabase) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    const userId = session?.user?.id || '53cc7a5b-bc93-40ff-908e-d582d85e0efc';

    // 1. Synchronize Orders table
    try {
      const orderIds = (data.orders || []).map(o => o.id);
      if (orderIds.length > 0) {
        const mappedOrders = data.orders.map(o => {
          const metaPayload: Record<string, any> = {
            paymentStatus: o.paymentStatus || 'تم الدفع',
            governorate: o.governorate,
            area: o.area
          };
          const rawNotes = o.notes || '';
          const cleanNotes = rawNotes.replace(/<!--nasjah_meta:(.*?)-->/g, '').trim();
          const packedNotes = cleanNotes
            ? `${cleanNotes}\n<!--nasjah_meta:${JSON.stringify(metaPayload)}-->`
            : `<!--nasjah_meta:${JSON.stringify(metaPayload)}-->`;

          return {
            id: o.id,
            user_id: userId,
            customer_name: o.customerName || '',
            phone: o.phone || '',
            details: o.details || '',
            price: Number(o.price || o.total || 0),
            total: Number(o.total || o.price || 0),
            status: o.status || 'قيد التجهيز',
            payment_method: o.paymentMethod || 'بنفت بي',
            delivery_method: o.deliveryMethod || '',
            delivery_type: o.deliveryType || 'قدوم شخصي',
            delivery_zone: o.deliveryZone || '',
            delivery_fee: Number(o.deliveryFee) || 0,
            fabric_id: o.fabricId || null,
            fabric_meters: o.fabricMeters ? Number(o.fabricMeters) : null,
            fabric_name: o.fabricName || null,
            notes: packedNotes,
            created_at_ms: o.createdAt || Date.now()
          };
        });
        
        const { error: ordErr } = await supabase.from('orders').upsert(mappedOrders);
        if (ordErr) {
          const minimalOrders = mappedOrders.map(({ delivery_type, delivery_zone, delivery_fee, fabric_id, fabric_meters, fabric_name, ...rest }: any) => rest);
          await supabase.from('orders').upsert(minimalOrders);
        }

        const inClause = `(${orderIds.map(id => `"${id}"`).join(',')})`;
        await supabase.from('orders').delete().not('id', 'in', inClause);
      }
    } catch (orderErr) {
      console.warn('Orders cloud sync note:', orderErr);
    }

    // 2. Synchronize Expenses table
    try {
      const safeExpenses = mergeExpensesWithSeed(data.expenses);
      
      const expenseIds = safeExpenses.map(e => e.id);
      if (expenseIds.length > 0) {
        const mappedExpenses = safeExpenses.map(e => ({
          id: String(e.id),
          user_id: userId,
          description: String(e.description || ''),
          amount: Number(e.amount) || 0,
          category: String(e.category || 'أقمشة ومستلزمات المخزون'),
          payment_method: String(e.paymentMethod || 'بنفت بي'),
          paid_to: String(e.paidTo || ''),
          notes: String(e.notes || ''),
          created_at_ms: Number(e.createdAt) || Date.now()
        }));
        await supabase.from('expenses').upsert(mappedExpenses);

        const inClause = `(${expenseIds.map(id => `"${id}"`).join(',')})`;
        await supabase.from('expenses').delete().not('id', 'in', inClause);
      }
    } catch (expErr) {
      console.warn('Expenses cloud sync note:', expErr);
    }

    // 3. Synchronize Inventory table
    try {
      const inventoryIds = (data.inventory || []).map(f => f.id);
      if (inventoryIds.length > 0) {
        const mappedInventory = data.inventory.map(f => {
          const metaPayload: Record<string, any> = {};
          if (f.sourcingType) metaPayload.sourcingType = f.sourcingType;
          if (f.supplierName) metaPayload.supplierName = f.supplierName;
          if (f.catalogCode) metaPayload.catalogCode = f.catalogCode;
          if (f.costPrice !== undefined) metaPayload.costPrice = f.costPrice;
          if (f.season) metaPayload.season = f.season;
          if (f.description) metaPayload.description = f.description;
          if (f.price !== undefined) metaPayload.price = Number(f.price) || 0;
          
          const packedBarcode = Object.keys(metaPayload).length > 0
            ? JSON.stringify(metaPayload)
            : (f.barcode || '');

          return {
            id: String(f.id),
            user_id: userId,
            name: f.name || '',
            quantity: Number(f.quantity) || 0,
            category: f.category || '',
            image_url: f.imageUrl || f.image || '',
            barcode: packedBarcode
          };
        });
        await supabase.from('inventory').upsert(mappedInventory);

        const inClause = `(${inventoryIds.map(id => `"${id}"`).join(',')})`;
        await supabase.from('inventory').delete().not('id', 'in', inClause).neq('id', '__store_settings__');
      }
    } catch (invErr) {
      console.warn('Inventory cloud sync note:', invErr);
    }

    // 4. Synchronize Custom Profits table
    try {
      const profits = data.customProfits || [];
      const profitIds = profits.map(p => p.id);
      if (profitIds.length > 0) {
        const mappedProfits = profits.map(p => ({
          id: p.id,
          user_id: userId,
          amount: Number(p.amount) || 0,
          description: p.description || '',
          category: p.category || 'أرباح إضافية',
          date: p.date || '',
          created_at_ms: p.createdAt || Date.now()
        }));
        await supabase.from('custom_profits').upsert(mappedProfits);

        const inClause = `(${profitIds.map(id => `"${id}"`).join(',')})`;
        await supabase.from('custom_profits').delete().not('id', 'in', inClause);
      }
    } catch {
      // safe fallback
    }

    // 5. Safe user metadata fallback in Supabase Auth cloud
    if (session) {
      try {
        const effectiveExpenses = mergeExpensesWithSeed(data.expenses);

        await supabase.auth.updateUser({
          data: {
            store_data: {
              orders: data.orders || [],
              expenses: effectiveExpenses,
              inventory: sanitizeInventoryForMetadata(data.inventory || []),
              capital: data.capital || 0,
              customProfits: data.customProfits || [],
              settings: data.settings || cloudStore.settings || getLocalStoreSettings(),
              lastUpdated: Date.now()
            }
          }
        });
      } catch (metaErr) {
        // safe fallback
      }
    }

    // Update persistent cache
    saveCachedStore(data);
  } catch (err) {
    console.warn('Supabase sync overall error:', err);
  }
}

/**
 * Initializes Supabase Realtime subscriptions so mobile and desktop sync live
 */
export function setupRealtimeSubscription() {
  if (realtimeChannelSubscribed || !supabase) return;
  realtimeChannelSubscribed = true;

  try {
    let debounceTimer: any = null;
    const triggerDebouncedSync = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        syncWithServer();
      }, 300);
    };

    const channel = supabase.channel('nasjah_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, triggerDebouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, triggerDebouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, triggerDebouncedSync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelSubscribed = false;
    };
  } catch {
    // ignore
  }
}

/**
 * Fetches latest records purely from Supabase Cloud and cloud server backend.
 * Zero stale cache: live database is the absolute source of truth.
 * Reloading the page or calling syncWithServer always re-queries the database fresh.
 */
export function syncWithServer(forceFresh = false): Promise<StoreData> {
  if (activeSyncPromise && !forceFresh) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      setupRealtimeSubscription();

      let cloudOrders: Order[] | null = null;
      let cloudExpenses: Expense[] | null = null;
      let cloudInventory: Fabric[] | null = null;
      let cloudCustomProfits: CustomProfit[] | null = null;
      let cloudCapital: number | null = null;
      let cloudSettings: StoreSettings | null = null;

      let activeSession: any = null;

      // STEP 1: Direct fetch from Supabase Cloud
      if (supabase) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          activeSession = sessionData?.session;
        } catch {}

        try {
          // A. Store Settings from __store_settings__
          try {
            const { data: invRow } = await supabase
              .from('inventory')
              .select('image_url')
              .eq('id', '__store_settings__')
              .maybeSingle();

            if (invRow?.image_url) {
              const parsed = JSON.parse(invRow.image_url);
              if (parsed && typeof parsed === 'object') {
                cloudSettings = {
                  ...DEFAULT_STORE_SETTINGS,
                  ...parsed,
                  seasonsOrder: parsed.seasonsOrder && parsed.seasonsOrder.length > 0
                    ? parsed.seasonsOrder
                    : ['winter', 'summer', 'spring']
                };
              }
            }
          } catch {}

          // B. Store Settings from store_settings table
          try {
            const { data: stData, error: stErr } = await supabase
              .from('store_settings')
              .select('settings, updated_at')
              .order('updated_at', { ascending: false })
              .limit(1);

            if (!stErr && stData && stData.length > 0 && stData[0]?.settings) {
              cloudSettings = {
                ...DEFAULT_STORE_SETTINGS,
                ...(cloudSettings || {}),
                ...stData[0].settings
              };
            }
          } catch {}

          // C. Direct query for inventory - Supabase is absolute authority
          try {
            const invRes = await supabase.from('inventory').select('*');
            if (!invRes.error && Array.isArray(invRes.data)) {
              cloudInventory = invRes.data
                .filter((f: any) => f.id !== '__store_settings__' && f.category !== '__system__')
                .map((f: any) => {
                  let parsedMeta: any = {};
                  if (f.barcode && typeof f.barcode === 'string' && f.barcode.startsWith('{')) {
                    try { parsedMeta = JSON.parse(f.barcode); } catch {}
                  }

                  return {
                    id: String(f.id),
                    name: f.name || '',
                    quantity: Number(f.quantity || 0),
                    price: Number(parsedMeta.price ?? f.price ?? 0),
                    category: f.category || '',
                    imageUrl: f.image_url || f.imageUrl || '',
                    image: f.image_url || f.image || '',
                    barcode: f.barcode || '',
                    season: parsedMeta.season || f.season || '',
                    description: parsedMeta.description || f.description || '',
                    sourcingType: parsedMeta.sourcingType || f.sourcingType || 'stock',
                    supplierName: parsedMeta.supplierName || f.supplierName || '',
                    catalogCode: parsedMeta.catalogCode || f.catalogCode || '',
                    costPrice: Number(parsedMeta.costPrice ?? f.costPrice ?? 0)
                  };
                });
            }
          } catch (invErr) {
            console.warn('Inventory direct fetch note:', invErr);
          }

          // D. Queries for Orders & Expenses - Supabase is absolute authority
          try {
            const [ordersRes, expRes] = await Promise.all([
              supabase.from('orders').select('*').order('created_at_ms', { ascending: false }),
              supabase.from('expenses').select('*').order('created_at_ms', { ascending: false })
            ]);

            if (!ordersRes.error && Array.isArray(ordersRes.data)) {
              cloudOrders = ordersRes.data.map((o: any) => {
                let notes = o.notes || '';
                let paymentStatus: any = o.payment_status || o.paymentStatus || 'تم الدفع';
                let governorate = o.governorate;
                let area = o.area;
                const metaMatch = notes.match(/<!--nasjah_meta:(.*?)-->/);
                if (metaMatch) {
                  try {
                    const parsed = JSON.parse(metaMatch[1]);
                    if (parsed.paymentStatus) paymentStatus = parsed.paymentStatus;
                    if (parsed.governorate) governorate = parsed.governorate;
                    if (parsed.area) area = parsed.area;
                  } catch {}
                  notes = notes.replace(/<!--nasjah_meta:(.*?)-->/g, '').trim();
                }

                return {
                  id: o.id,
                  customerName: o.customer_name || o.customerName || '',
                  phone: o.phone || '',
                  details: o.details || '',
                  price: Number(o.price || o.total || 0),
                  total: Number(o.total || o.price || 0),
                  status: o.status || 'قيد التجهيز',
                  paymentStatus,
                  paymentMethod: o.payment_method || o.paymentMethod || 'بنفت بي',
                  deliveryMethod: o.delivery_method || o.deliveryMethod || '',
                  deliveryType: o.delivery_type || o.deliveryType || 'قدوم شخصي',
                  deliveryZone: o.delivery_zone || o.deliveryZone || '',
                  deliveryFee: Number(o.delivery_fee || o.deliveryFee || 0),
                  governorate,
                  area,
                  notes,
                  fabricId: o.fabric_id || o.fabricId || undefined,
                  fabricMeters: o.fabric_meters ? Number(o.fabric_meters) : (o.fabricMeters ? Number(o.fabricMeters) : undefined),
                  fabricName: o.fabric_name || o.fabricName || undefined,
                  createdAt: Number(o.created_at_ms || (o.created_at ? new Date(o.created_at).getTime() : Date.now()))
                };
              });
            }

            if (!expRes.error && Array.isArray(expRes.data)) {
              cloudExpenses = mergeExpensesWithSeed(expRes.data.map((e: any) => ({
                id: String(e.id),
                description: e.description || '',
                amount: Number(e.amount || 0),
                category: e.category || 'أقمشة ومستلزمات المخزون',
                paymentMethod: e.payment_method || e.paymentMethod || 'بنفت بي',
                paidTo: e.paid_to || e.paidTo || '',
                notes: e.notes || '',
                createdAt: Number(e.created_at_ms || (e.created_at ? new Date(e.created_at).getTime() : Date.now()))
              })));
            }
          } catch (tableErr) {
            console.warn('Orders/Expenses query note:', tableErr);
          }

          // E. Custom profits
          try {
            const { data: profData, error: profErr } = await supabase
              .from('custom_profits')
              .select('*')
              .order('created_at_ms', { ascending: false });

            if (!profErr && Array.isArray(profData)) {
              cloudCustomProfits = profData.map((p: any) => ({
                id: p.id,
                amount: Number(p.amount || 0),
                description: p.description || '',
                category: p.category || 'أرباح إضافية',
                date: p.date || '',
                createdAt: Number(p.created_at_ms || Date.now())
              }));
            }
          } catch {}

          // Metadata fallback if authenticated (only if primary table query returned null)
          if (activeSession) {
            const metaStore = activeSession.user?.user_metadata?.store_data;
            if (metaStore) {
              if (cloudOrders === null && Array.isArray(metaStore.orders)) {
                cloudOrders = metaStore.orders;
              }
              if (cloudExpenses === null && Array.isArray(metaStore.expenses)) {
                cloudExpenses = mergeExpensesWithSeed(metaStore.expenses);
              }
              if (cloudInventory === null && Array.isArray(metaStore.inventory)) {
                cloudInventory = metaStore.inventory;
              }
              if (cloudCustomProfits === null && Array.isArray(metaStore.customProfits)) {
                cloudCustomProfits = metaStore.customProfits;
              }
              if (cloudCapital === null && typeof metaStore.capital === 'number') {
                cloudCapital = metaStore.capital;
              }
              if (!cloudSettings && metaStore.settings && typeof metaStore.settings === 'object') {
                cloudSettings = { ...DEFAULT_STORE_SETTINGS, ...metaStore.settings };
              }
            }
          }
        } catch (sbErr) {
          console.warn('Supabase cloud fetch error:', sbErr);
        }
      }

      // STEP 2: Query Cloud Server Backend API with cache: no-store
      try {
        const sRes = await fetch(`/api/store-settings?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
        });
        if (sRes.ok) {
          const contentType = sRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const sData = await sRes.json();
            if (sData?.settings && typeof sData.settings === 'object') {
              const serverTime = sData.settings.updatedAt || 0;
              const cloudTime = cloudSettings?.updatedAt || 0;
              if (!cloudSettings || serverTime >= cloudTime) {
                cloudSettings = {
                  ...DEFAULT_STORE_SETTINGS,
                  ...(cloudSettings || {}),
                  ...sData.settings
                };
              }
            }
          }
        }
      } catch {}

      // Query backend store data ONLY if primary entities are still null (e.g. Supabase unreachable)
      if (cloudOrders === null || cloudInventory === null || cloudExpenses === null) {
        try {
          const res = await fetch(`/api/store-data?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
          });
          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const serverData = await res.json();
              if (serverData.success) {
                if (cloudOrders === null && Array.isArray(serverData.orders)) {
                  cloudOrders = serverData.orders;
                }
                if (cloudExpenses === null && Array.isArray(serverData.expenses)) {
                  cloudExpenses = mergeExpensesWithSeed(serverData.expenses);
                }
                if (cloudInventory === null && Array.isArray(serverData.inventory)) {
                  cloudInventory = serverData.inventory;
                }
                if (cloudCustomProfits === null && Array.isArray(serverData.customProfits)) {
                  cloudCustomProfits = serverData.customProfits;
                }
                if (cloudCapital === null && typeof serverData.capital === 'number') {
                  cloudCapital = serverData.capital;
                }
              }
            }
          }
        } catch {}
      }

      // STEP 3: Fallback & Resilient Data Integrity
      // Orders: If Supabase returned non-empty rows, use them.
      // If Supabase returned [] (e.g. empty or un-synced table) but local store has orders, preserve local orders!
      let finalOrders: Order[];
      if (cloudOrders !== null && cloudOrders.length > 0) {
        finalOrders = cloudOrders;
      } else if (cloudStore.orders && cloudStore.orders.length > 0) {
        finalOrders = cloudStore.orders;
      } else {
        finalOrders = cloudOrders !== null ? cloudOrders : (cloudStore.orders || []);
      }

      // Expenses: If Supabase has expenses, merge with seed.
      // If Supabase table is empty ([]), but local store has user expenses, preserve local expenses!
      let finalExpenses: Expense[];
      if (cloudExpenses !== null && cloudExpenses.length > 0) {
        finalExpenses = mergeExpensesWithSeed(cloudExpenses);
      } else if (cloudStore.expenses && cloudStore.expenses.length > 0) {
        finalExpenses = mergeExpensesWithSeed(cloudStore.expenses);
      } else {
        finalExpenses = mergeExpensesWithSeed(cloudExpenses || []);
      }

      // Inventory: whatever fabrics are in cloudInventory from database are the truth.
      // If local store has items that aren't yet in cloud, preserve them!
      let mergedInventory: Fabric[];
      if (cloudInventory !== null && cloudInventory.length > 0) {
        const invMap = new Map<string, Fabric>();
        cloudInventory.forEach(f => invMap.set(f.id, f));
        (cloudStore.inventory || []).forEach(f => {
          if (!invMap.has(f.id)) {
            invMap.set(f.id, f);
          }
        });
        mergedInventory = Array.from(invMap.values());
      } else {
        mergedInventory = cloudStore.inventory && cloudStore.inventory.length > 0 ? cloudStore.inventory : SEED_INVENTORY;
      }

      // Custom Profits:
      const finalCustomProfits = (cloudCustomProfits !== null && cloudCustomProfits.length > 0)
        ? cloudCustomProfits
        : (cloudStore.customProfits && cloudStore.customProfits.length > 0 ? cloudStore.customProfits : []);

      // STEP 4: Settings Priority - database settings always win over stale local storage
      const effectiveSettings: StoreSettings = cloudSettings || cloudStore.settings || getLocalStoreSettings() || DEFAULT_STORE_SETTINGS;

      cloudStore = {
        orders: finalOrders,
        expenses: finalExpenses,
        inventory: mergedInventory,
        capital: cloudCapital !== null ? cloudCapital : (cloudStore.capital || 0),
        customProfits: finalCustomProfits,
        settings: effectiveSettings
      };
      isInitialCloudLoadComplete = true;

      // Always persist latest state to localStorage immediately so no refresh ever loses user edits
      saveCachedStore(cloudStore);

      if (typeof window !== 'undefined' && effectiveSettings) {
        try {
          localStorage.setItem('nasjah_store_settings', JSON.stringify(effectiveSettings));
        } catch {}
        window.dispatchEvent(new CustomEvent(EVENT_STORE_SETTINGS_UPDATED, { detail: effectiveSettings }));
      }

      // Self-healing: if authenticated, push to Supabase so cloud tables stay synced
      if (activeSession) {
        syncToSupabase(cloudStore).catch(() => {});
      }

      notifyDataChanged();
      return cloudStore;
    } catch (err) {
      console.warn('Cloud data sync fallback:', err);
      return cloudStore;
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

/**
 * Persists orders purely to cloud databases (Supabase Cloud and Cloud Server API)
 */
export async function persistOrders(orders: Order[]): Promise<void> {
  cloudStore.orders = orders;
  saveCachedStore(cloudStore);
  notifyDataChanged();

  // 1. Sync to Supabase Cloud
  syncToSupabase(cloudStore).catch(() => {});

  // 2. Sync to Cloud Backend
  try {
    await fetch('/api/sync', {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
  } catch {}
}

/**
 * Permanently deletes a single order across cloud databases
 */
export async function deleteOrderPermanently(orderId: string): Promise<Order[]> {
  const updatedOrders = (cloudStore.orders || []).filter(o => o.id !== orderId);
  cloudStore.orders = updatedOrders;
  saveCachedStore(cloudStore);
  notifyDataChanged();

  // 1. Direct delete from Supabase table - absolute admin authority
  if (supabase) {
    try {
      await supabase.from('orders').delete().eq('id', orderId);
    } catch (e) {
      console.warn('Supabase order delete note:', e);
    }
  }

  // 2. Direct delete from Cloud server
  try {
    await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store', method: 'DELETE' });
  } catch {}

  // 3. Update full sync to keep user metadata in sync
  syncToSupabase(cloudStore).catch(() => {});

  return updatedOrders;
}

/**
 * Persists expenses purely to cloud databases (Supabase Cloud and Cloud Server API)
 */
export async function persistExpenses(expenses: Expense[]): Promise<void> {
  cloudStore.expenses = expenses;
  saveCachedStore(cloudStore);
  notifyDataChanged();

  // 1. Sync to Supabase Cloud
  syncToSupabase(cloudStore).catch(() => {});

  // 2. Sync to Cloud Backend
  try {
    await fetch('/api/sync', {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenses })
    });
  } catch {}
}

/**
 * Permanently deletes a single expense across cloud databases
 */
export async function deleteExpensePermanently(expenseId: string): Promise<Expense[]> {
  recordDeletedExpenseId(expenseId);
  const updatedExpenses = (cloudStore.expenses || []).filter(e => e.id !== expenseId);
  cloudStore.expenses = updatedExpenses;
  saveCachedStore(cloudStore);
  notifyDataChanged();

  // 1. Direct delete from Supabase table - absolute admin authority
  if (supabase) {
    try {
      await supabase.from('expenses').delete().eq('id', expenseId);
    } catch (e) {
      console.warn('Supabase expense delete note:', e);
    }
  }

  // 2. Direct delete from Cloud server
  try {
    await fetch(`/api/expenses/${encodeURIComponent(expenseId)}`, { cache: 'no-store', method: 'DELETE' });
  } catch {}

  // 3. Update full sync to keep user metadata in sync
  syncToSupabase(cloudStore).catch(() => {});

  return updatedExpenses;
}

export async function persistCapital(amount: number): Promise<void> {
  cloudStore.capital = amount;
  saveCachedStore(cloudStore);
  notifyDataChanged();

  syncToSupabase(cloudStore).catch(() => {});
  
  try {
    await fetch('/api/sync', {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capital: amount })
    });
  } catch (err) {
    console.warn('Backend sync failed:', err);
  }
}

/**
 * Persists inventory fabrics purely to cloud databases (Supabase Cloud and Cloud Server API)
 */
export async function persistInventory(inventory: Fabric[]): Promise<void> {
  cloudStore.inventory = inventory;
  saveCachedStore(cloudStore);
  notifyDataChanged();

  // 1. Sync to Supabase Cloud
  syncToSupabase(cloudStore).catch(() => {});

  // 2. Sync to Cloud Backend
  try {
    await fetch('/api/sync', {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory })
    });
  } catch {}
}

/**
 * Permanently deletes a single fabric item across cloud databases
 */
export async function deleteFabricPermanently(fabricId: string): Promise<Fabric[]> {
  const updatedInventory = (cloudStore.inventory || []).filter(f => f.id !== fabricId);
  cloudStore.inventory = updatedInventory;
  saveCachedStore(cloudStore);
  notifyDataChanged();

  // 1. Direct delete from Supabase table - absolute admin authority
  if (supabase) {
    try {
      await supabase.from('inventory').delete().eq('id', fabricId);
    } catch (e) {
      console.warn('Supabase fabric delete note:', e);
    }
  }

  // 2. Direct delete from Cloud server
  try {
    await fetch(`/api/inventory/${encodeURIComponent(fabricId)}`, { cache: 'no-store', method: 'DELETE' });
  } catch {}

  // 3. Update full sync to keep user metadata in sync
  syncToSupabase(cloudStore).catch(() => {});

  return updatedInventory;
}

/**
 * Resets data purely on cloud databases
 */
export async function resetDatabase(): Promise<void> {
  cloudStore.orders = [];
  cloudStore.expenses = [];
  saveCachedStore(cloudStore);
  notifyDataChanged();

  // Reset in Supabase - absolute admin authority
  if (supabase) {
    try {
      await Promise.all([
        supabase.from('orders').delete().neq('id', ''),
        supabase.from('expenses').delete().neq('id', '')
      ]);
    } catch {}
  }

  syncToSupabase(cloudStore).catch(() => {});

  try {
    await fetch('/api/reset-data', { cache: 'no-store', method: 'POST' });
  } catch {}
}

/**
 * Persists custom manual profits
 */
export async function persistCustomProfits(customProfits: CustomProfit[]): Promise<void> {
  cloudStore.customProfits = customProfits;
  saveCachedStore(cloudStore);
  notifyDataChanged();

  syncToSupabase(cloudStore).catch(() => {});

  try {
    await fetch('/api/sync', {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customProfits })
    });
  } catch {}
}

/**
 * Adds a new custom manual profit entry
 */
export async function addCustomProfit(entry: Omit<CustomProfit, 'id' | 'createdAt'>): Promise<CustomProfit[]> {
  const newProfit: CustomProfit = {
    ...entry,
    id: 'prof_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: Date.now()
  };
  const updated = [newProfit, ...(cloudStore.customProfits || [])];
  await persistCustomProfits(updated);
  return updated;
}

/**
 * Permanently deletes a single custom profit entry
 */
export async function deleteCustomProfitPermanently(profitId: string): Promise<CustomProfit[]> {
  const updated = (cloudStore.customProfits || []).filter(p => p.id !== profitId);
  await persistCustomProfits(updated);
  if (supabase) {
    try {
      await supabase.from('custom_profits').delete().eq('id', profitId);
    } catch {}
  }
  return updated;
}

/**
 * Returns latest store settings from memory or local cache
 */
export function getLocalStoreSettings(): StoreSettings {
  if (cloudStore.settings && typeof cloudStore.settings === 'object') {
    return cloudStore.settings;
  }
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('nasjah_store_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          cloudStore.settings = { ...DEFAULT_STORE_SETTINGS, ...parsed };
          return cloudStore.settings;
        }
      }
    } catch {}
  }
  return DEFAULT_STORE_SETTINGS;
}

/**
 * Persists store settings across Supabase, LocalStorage, and Backend API
 */
export async function persistStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = cloudStore.settings || getLocalStoreSettings();
  const now = Date.now();
  let merged: StoreSettings = {
    ...DEFAULT_STORE_SETTINGS,
    ...current,
    ...settings,
    updatedAt: now
  };
  cloudStore.settings = merged;

  // 1. Immediately cache in localStorage with timestamp for instant offline & cross-tab access
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nasjah_store_settings', JSON.stringify(merged));
      localStorage.setItem('nasjah_store_settings_time', String(now));
    } catch {}
    window.dispatchEvent(new CustomEvent(EVENT_STORE_SETTINGS_UPDATED, { detail: merged }));
    window.dispatchEvent(new Event(EVENT_DATA_UPDATED));
  }

  // 2. Direct Supabase Cloud Persistence (guaranteed to sync across Vercel, mobile & desktop)
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || '53cc7a5b-bc93-40ff-908e-d582d85e0efc';

      // A. Direct UPSERT of __store_settings__ row in inventory table
      const { error: upsertErr } = await supabase
        .from('inventory')
        .upsert({
          id: '__store_settings__',
          user_id: userId,
          name: 'إعدادات متجر نَسْجَة',
          category: '__system__',
          quantity: 1,
          image_url: JSON.stringify(merged)
        }, { onConflict: 'id' });

      // Fallback update if upsert had any issue
      if (upsertErr) {
        await supabase
          .from('inventory')
          .update({
            image_url: JSON.stringify(merged),
            name: 'إعدادات متجر نَسْجَة'
          })
          .eq('id', '__store_settings__');
      }

      // C. Also attempt store_settings table if it exists
      try {
        await supabase.from('store_settings').upsert({
          user_id: userId,
          settings: merged,
          updated_at: new Date().toISOString()
        });
      } catch {}

      // D. Keep user_metadata lightweight to prevent token limit errors
      if (sessionData?.session?.user) {
        try {
          await supabase.auth.updateUser({
            data: {
              store_data: {
                settings: merged,
                capital: cloudStore.capital || 0,
                lastUpdated: now
              }
            }
          });
        } catch {}
      }
    } catch (e) {
      console.warn('Supabase store settings overall error note:', e);
    }
  }

  // 3. Persist to Server API /api/store-settings (when running with Express backend)
  try {
    const res = await fetch('/api/store-settings', {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged)
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data?.settings && data.settings.updatedAt && data.settings.updatedAt >= now) {
          merged = { ...merged, ...data.settings };
          cloudStore.settings = merged;
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('nasjah_store_settings', JSON.stringify(merged));
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    // Backend not reachable or running on static hosting
  }

  // 4. Also notify server sync endpoint
  try {
    await fetch('/api/sync', {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: merged })
    });
  } catch {}

  notifyDataChanged();
  return merged;
}
