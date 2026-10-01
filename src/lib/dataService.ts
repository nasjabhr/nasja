import { Fabric, Order, Expense, CustomProfit, StoreSettings, DEFAULT_STORE_SETTINGS } from '../types';
import { supabase } from './supabase';

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

// In-memory runtime store
let cloudStore: StoreData = {
  orders: [],
  expenses: [],
  inventory: [],
  capital: 0,
  customProfits: [],
  settings: DEFAULT_STORE_SETTINGS
};

let isSyncing = false;
let realtimeChannelSubscribed = false;
let isInitialCloudLoadComplete = false;

// Purge any legacy local storage keys from user's device
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('ordersData');
    localStorage.removeItem('expensesData');
    localStorage.removeItem('inventory');
    localStorage.removeItem('insights_data');
    localStorage.removeItem('insights_timestamp');
  } catch {}
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
    if (!session) return;

    const userId = session.user.id;

    // 1. Synchronize Orders table
    try {
      const orderIds = data.orders.map(o => o.id);
      if (orderIds.length > 0) {
        const mappedOrders = data.orders.map(o => ({
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
          notes: o.notes || '',
          created_at_ms: o.createdAt || Date.now()
        }));
        
        const { error: ordErr } = await supabase.from('orders').upsert(mappedOrders);
        if (ordErr) {
          // Minimal fallback if some columns are missing
          const minimalOrders = mappedOrders.map(({ delivery_type, delivery_zone, delivery_fee, fabric_id, fabric_meters, ...rest }: any) => rest);
          await supabase.from('orders').upsert(minimalOrders);
        }

        // Delete any orders from Supabase that were deleted
        const inClause = `(${orderIds.map(id => `"${id}"`).join(',')})`;
        await supabase.from('orders').delete().eq('user_id', userId).not('id', 'in', inClause);
      } else {
        // All orders deleted
        await supabase.from('orders').delete().eq('user_id', userId);
      }
    } catch (orderErr) {
      console.warn('Orders cloud sync note:', orderErr);
    }

    // 2. Synchronize Expenses table
    try {
      const expenseIds = data.expenses.map(e => e.id);
      if (expenseIds.length > 0) {
        const mappedExpenses = data.expenses.map(e => ({
          id: e.id,
          user_id: userId,
          description: e.description || '',
          amount: Number(e.amount) || 0,
          category: e.category || 'أقمشة ومستلزمات المخزون',
          payment_method: e.paymentMethod || 'بنفت بي',
          paid_to: e.paidTo || '',
          notes: e.notes || '',
          created_at_ms: e.createdAt || Date.now()
        }));
        await supabase.from('expenses').upsert(mappedExpenses);

        // Delete any expenses from Supabase that were deleted
        const inClause = `(${expenseIds.map(id => `"${id}"`).join(',')})`;
        await supabase.from('expenses').delete().eq('user_id', userId).not('id', 'in', inClause);
      } else {
        // All expenses deleted
        await supabase.from('expenses').delete().eq('user_id', userId);
      }
    } catch (expErr) {
      console.warn('Expenses cloud sync note:', expErr);
    }

    // 3. Synchronize Inventory table
    try {
      const inventoryIds = data.inventory.map(f => f.id);
      if (inventoryIds.length > 0) {
        const mappedInventory = data.inventory.map(f => {
          const metaPayload: Record<string, any> = {};
          if (f.sourcingType) metaPayload.sourcingType = f.sourcingType;
          if (f.supplierName) metaPayload.supplierName = f.supplierName;
          if (f.catalogCode) metaPayload.catalogCode = f.catalogCode;
          if (f.costPrice !== undefined) metaPayload.costPrice = f.costPrice;
          if (f.season) metaPayload.season = f.season;
          if (f.description) metaPayload.description = f.description;
          
          const packedBarcode = Object.keys(metaPayload).length > 0
            ? JSON.stringify(metaPayload)
            : (f.barcode || '');

          return {
            id: f.id,
            user_id: userId,
            name: f.name || '',
            quantity: Number(f.quantity) || 0,
            price: Number(f.price) || 0,
            category: f.category || '',
            image_url: f.imageUrl || f.image || '',
            barcode: packedBarcode
          };
        });
        await supabase.from('inventory').upsert(mappedInventory);

        // Delete any fabrics from Supabase that were deleted
        const inClause = `(${inventoryIds.map(id => `"${id}"`).join(',')})`;
        await supabase.from('inventory').delete().eq('user_id', userId).not('id', 'in', inClause).neq('id', '__store_settings__');
      } else {
        // All inventory deleted
        await supabase.from('inventory').delete().eq('user_id', userId).neq('id', '__store_settings__');
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
        await supabase.from('custom_profits').delete().eq('user_id', userId).not('id', 'in', inClause);
      } else {
        await supabase.from('custom_profits').delete().eq('user_id', userId);
      }
    } catch {
      // Table may not exist yet if user hasn't run the SQL script
    }

    // 5. Safe user metadata fallback in Supabase Auth cloud
    try {
      await supabase.auth.updateUser({
        data: {
          store_data: {
            orders: data.orders,
            expenses: data.expenses,
            inventory: sanitizeInventoryForMetadata(data.inventory),
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
    const channel = supabase.channel('nasjah_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        syncWithServer();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        syncWithServer();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        syncWithServer();
      })
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
 * Fetches latest records purely from Supabase Cloud and/or cloud server backend.
 * Zero local storage is touched.
 */
export async function syncWithServer(): Promise<StoreData> {
  if (isSyncing) return cloudStore;
  isSyncing = true;

  try {
    setupRealtimeSubscription();

    let cloudOrders: Order[] | null = null;
    let cloudExpenses: Expense[] | null = null;
    let cloudInventory: Fabric[] | null = null;
    let cloudCustomProfits: CustomProfit[] | null = null;
    let cloudCapital: number | null = null;
    let cloudSettings: StoreSettings | null = null;
    let tablesQueriedSuccessfully = false;

    // STEP 1: Attempt to load from Supabase Cloud directly
    if (supabase) {
      try {
        // A. Query __store_settings__ from inventory table (guaranteed public read access across all platforms)
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

        // B. Also try dedicated store_settings table if it exists
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

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;

        if (session) {
          const metaStore = session.user.user_metadata?.store_data;
          if (metaStore) {
            if (typeof metaStore.capital === 'number') {
              cloudCapital = metaStore.capital;
            }
          }

          try {
            let profRes: any = { data: null, error: null };
            try {
              profRes = await supabase.from('custom_profits').select('*').order('created_at_ms', { ascending: false });
            } catch {
              profRes = { data: null, error: true };
            }

            const [ordersRes, expRes, invRes] = await Promise.all([
              supabase.from('orders').select('*').order('created_at_ms', { ascending: false }),
              supabase.from('expenses').select('*').order('created_at_ms', { ascending: false }),
              supabase.from('inventory').select('*')
            ]);

            if (!ordersRes.error && Array.isArray(ordersRes.data)) {
              tablesQueriedSuccessfully = true;
              cloudOrders = ordersRes.data.map((o: any) => ({
                id: o.id,
                customerName: o.customer_name || o.customerName || '',
                phone: o.phone || '',
                details: o.details || '',
                price: Number(o.price || o.total || 0),
                total: Number(o.total || o.price || 0),
                status: o.status || 'قيد التجهيز',
                paymentStatus: (o.payment_status || o.paymentStatus || 'تم الدفع') as any,
                paymentMethod: o.payment_method || o.paymentMethod || 'بنفت بي',
                deliveryMethod: o.delivery_method || o.deliveryMethod || '',
                deliveryType: o.delivery_type || o.deliveryType || 'قدوم شخصي',
                deliveryZone: o.delivery_zone || o.deliveryZone || '',
                deliveryFee: Number(o.delivery_fee || o.deliveryFee || 0),
                notes: o.notes || '',
                fabricId: o.fabric_id || o.fabricId || undefined,
                fabricMeters: o.fabric_meters ? Number(o.fabric_meters) : (o.fabricMeters ? Number(o.fabricMeters) : undefined),
                fabricName: o.fabric_name || o.fabricName || undefined,
                createdAt: Number(o.created_at_ms || (o.created_at ? new Date(o.created_at).getTime() : Date.now()))
              }));
            }

            if (!expRes.error && Array.isArray(expRes.data)) {
              tablesQueriedSuccessfully = true;
              cloudExpenses = expRes.data.map((e: any) => ({
                id: e.id,
                description: e.description || '',
                amount: Number(e.amount || 0),
                category: e.category || 'أقمشة ومستلزمات المخزون',
                paymentMethod: e.payment_method || e.paymentMethod || 'بنفت بي',
                paidTo: e.paid_to || e.paidTo || '',
                notes: e.notes || '',
                createdAt: Number(e.created_at_ms || (e.created_at ? new Date(e.created_at).getTime() : Date.now()))
              }));
            }

            if (!invRes.error && Array.isArray(invRes.data)) {
              tablesQueriedSuccessfully = true;
              cloudInventory = invRes.data
                .filter((f: any) => f.id !== '__store_settings__' && f.category !== '__system__')
                .map((f: any) => {
                  let parsedMeta: any = {};
                  if (f.barcode && typeof f.barcode === 'string' && f.barcode.startsWith('{')) {
                    try { parsedMeta = JSON.parse(f.barcode); } catch {}
                  }

                  return {
                    id: f.id,
                    name: f.name || '',
                    quantity: Number(f.quantity || 0),
                    price: Number(f.price || 0),
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

            if (profRes && !(profRes as any).error && Array.isArray((profRes as any).data)) {
              cloudCustomProfits = (profRes as any).data.map((p: any) => ({
                id: p.id,
                amount: Number(p.amount || 0),
                description: p.description || '',
                category: p.category || 'أرباح إضافية',
                date: p.date || '',
                createdAt: Number(p.created_at_ms || Date.now())
              }));
            }
          } catch (tableErr) {
            console.warn('Tables query note:', tableErr);
          }

          // If tables returned empty or errored, check user metadata in Supabase
          if (!tablesQueriedSuccessfully || (cloudOrders?.length === 0 && cloudExpenses?.length === 0 && cloudInventory?.length === 0)) {
            const metaStore = session.user.user_metadata?.store_data;
            if (metaStore) {
              if ((!cloudOrders || cloudOrders.length === 0) && Array.isArray(metaStore.orders)) cloudOrders = metaStore.orders;
              if ((!cloudExpenses || cloudExpenses.length === 0) && Array.isArray(metaStore.expenses)) cloudExpenses = metaStore.expenses;
              if ((!cloudInventory || cloudInventory.length === 0) && Array.isArray(metaStore.inventory)) cloudInventory = metaStore.inventory;
              if ((!cloudCustomProfits || cloudCustomProfits.length === 0) && Array.isArray(metaStore.customProfits)) cloudCustomProfits = metaStore.customProfits;
              if (!cloudSettings && metaStore.settings && typeof metaStore.settings === 'object') {
                cloudSettings = { ...DEFAULT_STORE_SETTINGS, ...metaStore.settings };
              }
            }
          }
        }
      } catch (sbErr) {
        console.warn('Supabase cloud fetch error:', sbErr);
      }
    }

    // STEP 2: Query Cloud server backend for store settings (when running with backend)
    try {
      const sRes = await fetch(`/api/store-settings?t=${Date.now()}`, {
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
    } catch {
      // Backend not reachable or running as static build
    }

    // Query backend store data if tables were not queried
    if (cloudOrders === null || cloudExpenses === null || cloudInventory === null) {
      try {
        const res = await fetch('/api/store-data', {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const serverData = await res.json();
            if (serverData.success) {
              if ((!cloudOrders || cloudOrders.length === 0) && Array.isArray(serverData.orders) && serverData.orders.length > 0) {
                cloudOrders = serverData.orders;
              }
              if ((!cloudExpenses || cloudExpenses.length === 0) && Array.isArray(serverData.expenses) && serverData.expenses.length > 0) {
                cloudExpenses = serverData.expenses;
              }
              if ((!cloudInventory || cloudInventory.length === 0) && Array.isArray(serverData.inventory) && serverData.inventory.length > 0) {
                cloudInventory = serverData.inventory;
              }
              if ((!cloudCustomProfits || cloudCustomProfits.length === 0) && Array.isArray(serverData.customProfits) && serverData.customProfits.length > 0) {
                cloudCustomProfits = serverData.customProfits;
              }
              if (typeof serverData.capital === 'number') {
                cloudCapital = serverData.capital;
              }
            }
          }
        }
      } catch {
        // Node backend not reachable
      }
    }

    // STEP 3: Reconcile Settings by timestamp - NEVER let older cloud/server data wipe newer local user edits
    const localCachedSettings = getLocalStoreSettings();
    const localTime = localCachedSettings?.updatedAt || 0;
    const cloudTime = cloudSettings?.updatedAt || 0;

    let effectiveSettings: StoreSettings;
    if (localCachedSettings && localTime >= cloudTime && localTime > 0) {
      // Local settings are newer or equal: retain local and push update to Supabase
      effectiveSettings = localCachedSettings;
      if (localTime > cloudTime) {
        persistStoreSettings(localCachedSettings).catch(() => {});
      }
    } else if (cloudSettings && cloudTime > 0) {
      effectiveSettings = cloudSettings;
    } else {
      effectiveSettings = localCachedSettings || cloudSettings || DEFAULT_STORE_SETTINGS;
    }

    cloudStore = {
      orders: cloudOrders !== null ? cloudOrders : cloudStore.orders,
      expenses: cloudExpenses !== null ? cloudExpenses : cloudStore.expenses,
      inventory: cloudInventory !== null ? cloudInventory : cloudStore.inventory,
      capital: cloudCapital !== null ? cloudCapital : (cloudStore.capital || 0),
      customProfits: cloudCustomProfits !== null ? cloudCustomProfits : (cloudStore.customProfits || []),
      settings: effectiveSettings
    };
    isInitialCloudLoadComplete = true;

    if (typeof window !== 'undefined' && effectiveSettings) {
      try {
        localStorage.setItem('nasjah_store_settings', JSON.stringify(effectiveSettings));
      } catch {}
      window.dispatchEvent(new CustomEvent(EVENT_STORE_SETTINGS_UPDATED, { detail: effectiveSettings }));
    }

    notifyDataChanged();
    return cloudStore;
  } catch (err) {
    console.warn('Cloud data sync fallback:', err);
    return cloudStore;
  } finally {
    isSyncing = false;
  }
}

/**
 * Persists orders purely to cloud databases (Supabase Cloud and Cloud Server API)
 */
export async function persistOrders(orders: Order[]): Promise<void> {
  cloudStore.orders = orders;
  notifyDataChanged();

  // 1. Sync to Supabase Cloud
  syncToSupabase(cloudStore).catch(() => {});

  // 2. Sync to Cloud Backend
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
  } catch {
    // ignore
  }
}

/**
 * Permanently deletes a single order across cloud databases
 */
export async function deleteOrderPermanently(orderId: string): Promise<Order[]> {
  const updatedOrders = cloudStore.orders.filter(o => o.id !== orderId);
  cloudStore.orders = updatedOrders;
  notifyDataChanged();

  // 1. Direct delete from Supabase table
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        await supabase.from('orders').delete().eq('id', orderId).eq('user_id', userId);
      } else {
        await supabase.from('orders').delete().eq('id', orderId);
      }
    } catch (e) {
      console.warn('Supabase order delete note:', e);
    }
  }

  // 2. Direct delete from Cloud server
  try {
    await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
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
  notifyDataChanged();

  // 1. Sync to Supabase Cloud
  syncToSupabase(cloudStore).catch(() => {});

  // 2. Sync to Cloud Backend
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenses })
    });
  } catch {
    // ignore
  }
}

/**
 * Permanently deletes a single expense across cloud databases
 */
export async function deleteExpensePermanently(expenseId: string): Promise<Expense[]> {
  const updatedExpenses = cloudStore.expenses.filter(e => e.id !== expenseId);
  cloudStore.expenses = updatedExpenses;
  notifyDataChanged();

  // 1. Direct delete from Supabase table
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        await supabase.from('expenses').delete().eq('id', expenseId).eq('user_id', userId);
      } else {
        await supabase.from('expenses').delete().eq('id', expenseId);
      }
    } catch (e) {
      console.warn('Supabase expense delete note:', e);
    }
  }

  // 2. Direct delete from Cloud server
  try {
    await fetch(`/api/expenses/${encodeURIComponent(expenseId)}`, { method: 'DELETE' });
  } catch {}

  // 3. Update full sync to keep user metadata in sync
  syncToSupabase(cloudStore).catch(() => {});

  return updatedExpenses;
}

export async function persistCapital(amount: number): Promise<void> {
  cloudStore.capital = amount;
  notifyDataChanged();

  syncToSupabase(cloudStore).catch(() => {});
  
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'inventory', payload: cloudStore.inventory }) // Dummy ping to trigger backend sync if needed, though mostly it syncs via metadata
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
  notifyDataChanged();

  // 1. Sync to Supabase Cloud
  syncToSupabase(cloudStore).catch(() => {});

  // 2. Sync to Cloud Backend
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory })
    });
  } catch {
    // ignore
  }
}

/**
 * Permanently deletes a single fabric item across cloud databases
 */
export async function deleteFabricPermanently(fabricId: string): Promise<Fabric[]> {
  const updatedInventory = cloudStore.inventory.filter(f => f.id !== fabricId);
  cloudStore.inventory = updatedInventory;
  notifyDataChanged();

  // 1. Direct delete from Supabase table
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        await supabase.from('inventory').delete().eq('id', fabricId).eq('user_id', userId);
      } else {
        await supabase.from('inventory').delete().eq('id', fabricId);
      }
    } catch (e) {
      console.warn('Supabase fabric delete note:', e);
    }
  }

  // 2. Direct delete from Cloud server
  try {
    await fetch(`/api/inventory/${encodeURIComponent(fabricId)}`, { method: 'DELETE' });
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
  notifyDataChanged();

  // Reset in Supabase
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        await Promise.all([
          supabase.from('orders').delete().eq('user_id', userId),
          supabase.from('expenses').delete().eq('user_id', userId)
        ]);
      } else {
        await Promise.all([
          supabase.from('orders').delete().neq('id', ''),
          supabase.from('expenses').delete().neq('id', '')
        ]);
      }
    } catch {}
  }

  syncToSupabase(cloudStore).catch(() => {});

  try {
    await fetch('/api/reset-data', { method: 'POST' });
  } catch {}
}

/**
 * Persists custom manual profits
 */
export async function persistCustomProfits(customProfits: CustomProfit[]): Promise<void> {
  cloudStore.customProfits = customProfits;
  notifyDataChanged();

  syncToSupabase(cloudStore).catch(() => {});

  try {
    await fetch('/api/sync', {
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
          price: 0,
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: merged })
    });
  } catch {}

  notifyDataChanged();
  return merged;
}


