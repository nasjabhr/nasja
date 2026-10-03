/**
 * Nasjah Atelier — Hardened Backend API (single Vercel Serverless Function)
 *
 * Routes (via vercel.json rewrite /api/:route -> /api?route=:route):
 *   GET  /api/health  -> liveness + security mode (no secrets)
 *   GET  /api/store   -> public storefront catalog (sanitized, no cost/supplier/stock data)
 *   GET  /api/admin   -> full ERP state (founders only)
 *   POST /api/admin   -> mutations (founders only)
 *
 * Security model:
 *   - Every admin request must carry a Supabase access token (Bearer). The token is verified
 *     server-side with Supabase Auth and the user must be on the founders allow-list.
 *   - Database access uses SUPABASE_SERVICE_ROLE_KEY (server-only env var, never shipped to the browser).
 *     Once it is configured, all table grants for anon/authenticated can be revoked (see supabase/secure-lockdown.sql).
 *   - All inputs are validated, size-capped and whitelisted. System rows cannot be touched by clients.
 *   - Same-origin only (no CORS), per-IP rate limiting, no caching of any response.
 *
 * This file is intentionally self-contained (no relative imports) for reliable Vercel ESM bundling.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

// ============================================================================
// Configuration
// ============================================================================
const ENV: Record<string, string | undefined> = ((globalThis as any).process?.env || {}) as Record<string, string | undefined>;

const DEFAULT_SUPABASE_URL = 'https://rpjozutuzdfoszqfogko.supabase.co';
// Public anon key (safe to embed: it is already public in the frontend bundle and is only used to verify tokens).
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwam96dXR1emRmb3N6cWZvZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzYwMDQsImV4cCI6MjEwNDA1MjAwNH0.FjsZgQQLRaVGGUmspfg2SyvpZsL4mYp4GQHQoHJ56JI';

const pickUrl = (v?: string) => (v && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(v.trim()) ? v.trim().replace(/\/$/, '') : '');
const SUPABASE_URL = pickUrl(ENV.SUPABASE_URL) || pickUrl(ENV.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  [ENV.SUPABASE_ANON_KEY, ENV.VITE_SUPABASE_ANON_KEY].find((k) => typeof k === 'string' && k.trim().length > 50)?.trim() || DEFAULT_ANON_KEY;
const SERVICE_ROLE_KEY = (ENV.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const HAS_SERVICE_ROLE = SERVICE_ROLE_KEY.length > 30 && SERVICE_ROLE_KEY !== SUPABASE_ANON_KEY;

const ADMIN_EMAILS = (ENV.ADMIN_EMAILS || 'nasjahbh@gmail.com,nasjabhr@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_UIDS = (ENV.ADMIN_UIDS || '53cc7a5b-bc93-40ff-908e-d582d85e0efc,0843d2d4-0702-4ecf-800b-956155367d0a')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const API_VERSION = '4.7.1';
const SETTINGS_ROW_ID = '__store_settings__';
const SYSTEM_CATEGORY = '__system__';
const CRITICAL_FABRIC_THRESHOLD = 3.0;
const MAX_ITEMS_PER_REQUEST = 500;
const MAX_LEGACY_ITEMS = 2000;

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const authClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOpts);
const serviceClient: SupabaseClient | null = HAS_SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, clientOpts) : null;

/** Fallback (until the service role key is configured): act as the verified user so RLS still applies. */
function userScopedClient(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...clientOpts,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// ============================================================================
// Domain types (mirrors src/types.ts)
// ============================================================================
interface Order {
  id: string; customerName: string; phone: string; details: string; price: number; total?: number;
  status: string; paymentStatus?: string; paymentMethod?: string; deliveryMethod?: string; deliveryType?: string;
  deliveryZone?: string; governorate?: string; area?: string; deliveryFee?: number; notes?: string; createdAt: number;
  fabricId?: string; fabricMeters?: number; fabricName?: string;
}
interface Expense {
  id: string; description: string; amount: number; category: string; paymentMethod?: string; paidTo?: string;
  notes?: string; createdAt: number;
}
interface Fabric {
  id: string; name: string; quantity: number; price: number; imageUrl?: string; image?: string; barcode?: string;
  category?: string; season?: string; description?: string; sourcingType?: 'catalog' | 'stock'; supplierName?: string;
  catalogCode?: string; costPrice?: number;
}
interface CustomProfit { id: string; amount: number; description: string; category?: string; date?: string; createdAt: number }
interface StoreSettings {
  whatsappNumber: string; storeName: string; storeTagline: string; announcementText: string; instagramHandle: string;
  defaultThobeMeters: number; hideOutOfStock: boolean; defaultSeason: 'all' | 'summer' | 'winter' | 'spring';
  headerVisible: boolean; seasonsOrder: ('winter' | 'summer' | 'spring')[]; updatedAt?: number;
}
interface SystemState { capital?: number; seededExpensesV1?: boolean }
interface StoreData {
  orders: Order[]; expenses: Expense[]; inventory: Fabric[]; customProfits: CustomProfit[]; capital: number; settings: StoreSettings;
}
type Entity = 'orders' | 'expenses' | 'inventory' | 'customProfits';

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  whatsappNumber: '38244795',
  storeName: 'نَسْجَة',
  storeTagline: 'أقمشة وخياطة رجالية',
  announcementText: 'أقمشة وتفصيل حسب الطلب • جودة وخياطة مضمونة',
  instagramHandle: 'nasjah.bh',
  defaultThobeMeters: 3.5,
  hideOutOfStock: false,
  defaultSeason: 'all',
  headerVisible: true,
  seasonsOrder: ['winter', 'summer', 'spring'],
  updatedAt: 0,
};

// ============================================================================
// HTTP helpers
// ============================================================================
class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public detail?: string) {
    super(message);
  }
}

function setApiHeaders(res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('X-API-Version', API_VERSION);
}

function send(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function header(req: any, name: string): string {
  const v = req.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? String(v[0] || '') : String(v || '');
}

function clientIp(req: any): string {
  const fwd = header(req, 'x-forwarded-for').split(',')[0].trim();
  return fwd || header(req, 'x-real-ip') || req.socket?.remoteAddress || 'unknown';
}

function resolveRoute(req: any): string {
  const q = req.query?.route;
  let raw = Array.isArray(q) ? q[0] : q;
  if (!raw) {
    try {
      raw = new URL(String(req.url || '/'), 'http://localhost').pathname.replace(/^\/api\/?/, '');
    } catch {
      raw = '';
    }
  }
  return String(raw || '').split('/')[0].trim().toLowerCase();
}

/** Blocks cross-site browser requests. Same-origin requests either omit Origin or match the Host. */
function assertSameOrigin(req: any) {
  const origin = header(req, 'origin');
  if (!origin) return;
  let originHost = '';
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw new HttpError(403, 'bad_origin', 'طلب مرفوض');
  }
  const host = (header(req, 'x-forwarded-host') || header(req, 'host')).split(',')[0].trim().toLowerCase();
  const isLocalDev = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(originHost) && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (originHost !== host && !isLocalDev) throw new HttpError(403, 'bad_origin', 'طلب مرفوض');
}

function parseBody(req: any): any {
  const b = req.body;
  if (b == null || b === '') return {};
  if (typeof b === 'object') return b;
  if (typeof b === 'string') {
    if (b.length > 4_500_000) throw new HttpError(413, 'payload_too_large', 'حجم الطلب كبير جداً');
    try {
      return JSON.parse(b);
    } catch {
      throw new HttpError(400, 'bad_json', 'صيغة الطلب غير صحيحة');
    }
  }
  throw new HttpError(400, 'bad_body', 'صيغة الطلب غير صحيحة');
}

// ---------- In-memory rate limiting (per serverless instance) ----------
const buckets = new Map<string, { count: number; reset: number }>();
function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > limit) throw new HttpError(429, 'rate_limited', 'طلبات كثيرة جداً، يرجى المحاولة بعد قليل');
}

// ============================================================================
// Validation / sanitization
// ============================================================================
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
function str(v: unknown, max: number, def = ''): string {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return def;
  return v.replace(CONTROL_CHARS, '').trim().slice(0, max);
}
function num(v: unknown, min: number, max: number, def = 0): number {
  const n = typeof v === 'string' ? Number(v.trim()) : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
function optNum(v: unknown, min: number, max: number): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
}
const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;
function cleanId(v: unknown): string | null {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  return ID_RE.test(s) && !s.startsWith('__') ? s : null;
}
function cleanImage(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (!s) return '';
  if (/^https?:\/\/[^\s"'<>]{1,2040}$/i.test(s)) return s;
  if (s.length <= 3_000_000 && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s;
  return '';
}
const META_RE = /<!--nasjah_meta:(.*?)-->/g;
const NOW = () => Date.now();

function sanitizeOrder(o: any): Order | null {
  const id = cleanId(o?.id);
  if (!id) return null;
  const price = num(o.price ?? o.total, 0, 1_000_000);
  return {
    id,
    customerName: str(o.customerName, 120),
    phone: str(o.phone, 30),
    details: str(o.details, 2000),
    price,
    total: num(o.total ?? o.price, 0, 1_000_000, price),
    status: str(o.status, 40, 'قيد التجهيز') || 'قيد التجهيز',
    paymentStatus: str(o.paymentStatus, 40, 'تم الدفع') || 'تم الدفع',
    paymentMethod: str(o.paymentMethod, 40, 'بنفت بي') || 'بنفت بي',
    deliveryMethod: str(o.deliveryMethod, 60),
    deliveryType: str(o.deliveryType, 30, 'قدوم شخصي') || 'قدوم شخصي',
    deliveryZone: str(o.deliveryZone, 120),
    governorate: str(o.governorate, 60) || undefined,
    area: str(o.area, 60) || undefined,
    deliveryFee: num(o.deliveryFee, 0, 1000),
    notes: str(o.notes, 2000).replace(META_RE, '').trim(),
    createdAt: Math.round(num(o.createdAt, 0, 8.64e15, NOW())) || NOW(),
    fabricId: str(o.fabricId, 64) || undefined,
    fabricMeters: optNum(o.fabricMeters, 0, 100_000),
    fabricName: str(o.fabricName, 200) || undefined,
  };
}

function sanitizeExpense(e: any): Expense | null {
  const id = cleanId(e?.id);
  if (!id) return null;
  return {
    id,
    description: str(e.description, 300),
    amount: num(e.amount, 0, 1_000_000),
    category: str(e.category, 80, 'عام ومصاريف أخرى') || 'عام ومصاريف أخرى',
    paymentMethod: str(e.paymentMethod, 40, 'بنفت بي') || 'بنفت بي',
    paidTo: str(e.paidTo, 120),
    notes: str(e.notes, 2000),
    createdAt: Math.round(num(e.createdAt, 0, 8.64e15, NOW())) || NOW(),
  };
}

function sanitizeFabric(f: any): Fabric | null {
  const id = cleanId(f?.id);
  if (!id) return null;
  const category = str(f.category, 60);
  if (category === SYSTEM_CATEGORY) return null;
  const sourcing = f.sourcingType === 'catalog' ? 'catalog' : f.sourcingType === 'stock' ? 'stock' : undefined;
  const image = cleanImage(f.imageUrl || f.image);
  let barcode = str(f.barcode, 120);
  if (barcode.startsWith('{')) barcode = ''; // never accept packed metadata from clients
  return {
    id,
    name: str(f.name, 200) || 'بدون اسم',
    quantity: num(f.quantity, 0, 99_999_999),
    price: num(f.price, 0, 1_000_000),
    imageUrl: image,
    image,
    barcode,
    category,
    season: str(f.season, 40) || undefined,
    description: str(f.description, 2000) || undefined,
    sourcingType: sourcing,
    supplierName: str(f.supplierName, 120) || undefined,
    catalogCode: str(f.catalogCode, 120) || undefined,
    costPrice: optNum(f.costPrice, 0, 1_000_000),
  };
}

function sanitizeProfit(p: any): CustomProfit | null {
  const id = cleanId(p?.id);
  if (!id) return null;
  return {
    id,
    amount: num(p.amount, -1_000_000, 1_000_000),
    description: str(p.description, 300),
    category: str(p.category, 80, 'أرباح إضافية') || 'أرباح إضافية',
    date: str(p.date, 40),
    createdAt: Math.round(num(p.createdAt, 0, 8.64e15, NOW())) || NOW(),
  };
}

const SEASONS = ['winter', 'summer', 'spring'] as const;
function sanitizeSettings(input: any, base: StoreSettings): StoreSettings {
  const s: StoreSettings = { ...DEFAULT_STORE_SETTINGS, ...base };
  if (!input || typeof input !== 'object') return s;
  if ('whatsappNumber' in input) s.whatsappNumber = str(input.whatsappNumber, 20).replace(/[^0-9+]/g, '') || s.whatsappNumber;
  if ('storeName' in input) s.storeName = str(input.storeName, 60) || s.storeName;
  if ('storeTagline' in input) s.storeTagline = str(input.storeTagline, 160);
  if ('announcementText' in input) s.announcementText = str(input.announcementText, 400);
  if ('instagramHandle' in input) s.instagramHandle = str(input.instagramHandle, 40).replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '');
  if ('defaultThobeMeters' in input) s.defaultThobeMeters = num(input.defaultThobeMeters, 0.5, 30, s.defaultThobeMeters);
  if ('hideOutOfStock' in input) s.hideOutOfStock = input.hideOutOfStock === true;
  if ('headerVisible' in input) s.headerVisible = input.headerVisible !== false;
  if ('defaultSeason' in input) {
    s.defaultSeason = ['all', 'summer', 'winter', 'spring'].includes(input.defaultSeason) ? input.defaultSeason : 'all';
  }
  if ('seasonsOrder' in input && Array.isArray(input.seasonsOrder)) {
    const order = input.seasonsOrder.filter((x: any, i: number, arr: any[]) => SEASONS.includes(x) && arr.indexOf(x) === i);
    for (const x of SEASONS) if (!order.includes(x)) order.push(x);
    s.seasonsOrder = order;
  }
  return s;
}

// ============================================================================
// Row <-> model mapping (Supabase schema quirks are handled ONLY here)
//   - orders.payment_status does not exist -> stored in a meta comment inside notes
//   - inventory has no price/season/description columns -> packed as JSON in barcode
//   - store settings + system state live in inventory row "__store_settings__" (image_url JSON)
// ============================================================================
function parseJson(v: unknown): any {
  if (typeof v !== 'string' || !v.trim().startsWith('{')) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function rowToOrder(o: any): Order {
  let notes = String(o.notes || '');
  let paymentStatus = o.payment_status || 'تم الدفع';
  let governorate = o.governorate || undefined;
  let area = o.area || undefined;
  const m = notes.match(/<!--nasjah_meta:(.*?)-->/);
  if (m) {
    const meta = parseJson(m[1]);
    if (meta) {
      if (meta.paymentStatus) paymentStatus = meta.paymentStatus;
      if (meta.governorate) governorate = meta.governorate;
      if (meta.area) area = meta.area;
    }
    notes = notes.replace(META_RE, '').trim();
  }
  return {
    id: String(o.id),
    customerName: o.customer_name || '',
    phone: o.phone || '',
    details: o.details || '',
    price: Number(o.price ?? o.total ?? 0) || 0,
    total: Number(o.total ?? o.price ?? 0) || 0,
    status: o.status || 'قيد التجهيز',
    paymentStatus,
    paymentMethod: o.payment_method || 'بنفت بي',
    deliveryMethod: o.delivery_method || '',
    deliveryType: o.delivery_type || 'قدوم شخصي',
    deliveryZone: o.delivery_zone || '',
    deliveryFee: Number(o.delivery_fee || 0) || 0,
    governorate,
    area,
    notes,
    fabricId: o.fabric_id || undefined,
    fabricMeters: o.fabric_meters != null && Number(o.fabric_meters) > 0 ? Number(o.fabric_meters) : undefined,
    fabricName: o.fabric_name || undefined,
    createdAt: Number(o.created_at_ms) || (o.created_at ? new Date(o.created_at).getTime() : 0),
  };
}

function orderToRow(o: Order, userId: string) {
  const meta = { paymentStatus: o.paymentStatus || 'تم الدفع', governorate: o.governorate, area: o.area };
  const clean = (o.notes || '').replace(META_RE, '').trim();
  return {
    id: o.id,
    user_id: userId,
    customer_name: o.customerName || '',
    phone: o.phone || '',
    details: o.details || '',
    price: o.price || 0,
    total: o.total ?? o.price ?? 0,
    status: o.status || 'قيد التجهيز',
    payment_method: o.paymentMethod || 'بنفت بي',
    delivery_method: o.deliveryMethod || '',
    delivery_type: o.deliveryType || 'قدوم شخصي',
    delivery_zone: o.deliveryZone || '',
    delivery_fee: o.deliveryFee || 0,
    fabric_id: o.fabricId || null,
    fabric_meters: o.fabricMeters ?? null,
    fabric_name: o.fabricName || null,
    notes: clean ? `${clean}\n<!--nasjah_meta:${JSON.stringify(meta)}-->` : `<!--nasjah_meta:${JSON.stringify(meta)}-->`,
    created_at_ms: o.createdAt || NOW(),
  };
}

function rowToExpense(e: any): Expense {
  return {
    id: String(e.id),
    description: e.description || '',
    amount: Number(e.amount || 0) || 0,
    category: e.category || 'عام ومصاريف أخرى',
    paymentMethod: e.payment_method || 'بنفت بي',
    paidTo: e.paid_to || '',
    notes: e.notes || '',
    createdAt: Number(e.created_at_ms) || (e.created_at ? new Date(e.created_at).getTime() : 0),
  };
}

function expenseToRow(e: Expense, userId: string) {
  return {
    id: e.id,
    user_id: userId,
    description: e.description,
    amount: e.amount,
    category: e.category,
    payment_method: e.paymentMethod || 'بنفت بي',
    paid_to: e.paidTo || '',
    notes: e.notes || '',
    created_at_ms: e.createdAt || NOW(),
  };
}

function rowToFabric(f: any): Fabric {
  const meta = parseJson(f.barcode) || {};
  const rawBarcode = typeof f.barcode === 'string' && !f.barcode.trim().startsWith('{') ? f.barcode : '';
  const image = f.image_url || '';
  return {
    id: String(f.id),
    name: f.name || '',
    quantity: Number(f.quantity || 0) || 0,
    price: Number(meta.price ?? 0) || 0,
    imageUrl: image,
    image,
    barcode: meta.code || rawBarcode || '',
    category: f.category || '',
    season: meta.season || undefined,
    description: meta.description || undefined,
    sourcingType: meta.sourcingType === 'catalog' ? 'catalog' : meta.sourcingType === 'stock' ? 'stock' : undefined,
    supplierName: meta.supplierName || undefined,
    catalogCode: meta.catalogCode || undefined,
    costPrice: meta.costPrice != null ? Number(meta.costPrice) || 0 : undefined,
  };
}

function fabricToRow(f: Fabric, userId: string) {
  const meta: Record<string, unknown> = { price: f.price || 0 };
  if (f.sourcingType) meta.sourcingType = f.sourcingType;
  if (f.supplierName) meta.supplierName = f.supplierName;
  if (f.catalogCode) meta.catalogCode = f.catalogCode;
  if (f.costPrice !== undefined) meta.costPrice = f.costPrice;
  if (f.season) meta.season = f.season;
  if (f.description) meta.description = f.description;
  if (f.barcode) meta.code = f.barcode;
  return {
    id: f.id,
    user_id: userId,
    name: f.name,
    quantity: f.quantity,
    category: f.category || '',
    image_url: f.imageUrl || '',
    barcode: JSON.stringify(meta),
  };
}

function rowToProfit(p: any): CustomProfit {
  return {
    id: String(p.id),
    amount: Number(p.amount || 0) || 0,
    description: p.description || '',
    category: p.category || 'أرباح إضافية',
    date: p.date || '',
    createdAt: Number(p.created_at_ms) || (p.created_at ? new Date(p.created_at).getTime() : 0),
  };
}

function profitToRow(p: CustomProfit, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    amount: p.amount,
    description: p.description,
    category: p.category || 'أرباح إضافية',
    date: p.date || '',
    created_at_ms: p.createdAt || NOW(),
  };
}

const ENTITY: Record<Entity, { table: string; sanitize: (x: any) => any; toRow: (x: any, uid: string) => any }> = {
  orders: { table: 'orders', sanitize: sanitizeOrder, toRow: orderToRow },
  expenses: { table: 'expenses', sanitize: sanitizeExpense, toRow: expenseToRow },
  inventory: { table: 'inventory', sanitize: sanitizeFabric, toRow: fabricToRow },
  customProfits: { table: 'custom_profits', sanitize: sanitizeProfit, toRow: profitToRow },
};

function parseSettingsRow(row: any): { settings: StoreSettings; system: SystemState } {
  const parsed = parseJson(row?.image_url) || {};
  const { _system, ...rest } = parsed;
  return {
    settings: sanitizeSettings(rest, { ...DEFAULT_STORE_SETTINGS, updatedAt: Number(rest.updatedAt) || 0 }),
    system: _system && typeof _system === 'object' ? _system : {},
  };
}

async function writeSettingsRow(db: SupabaseClient, userId: string, settings: StoreSettings, system: SystemState) {
  const { error } = await db.from('inventory').upsert(
    {
      id: SETTINGS_ROW_ID,
      user_id: userId,
      name: 'إعدادات متجر نَسْجَة',
      category: SYSTEM_CATEGORY,
      quantity: 1,
      image_url: JSON.stringify({ ...settings, _system: system }),
    },
    { onConflict: 'id' },
  );
  if (error) throw new HttpError(502, 'db_write_failed', 'تعذر حفظ الإعدادات في قاعدة البيانات', error.message);
}

// ============================================================================
// Data access
// ============================================================================
interface RawState { data: StoreData; system: SystemState; settingsRowExists: boolean }

async function readRaw(db: SupabaseClient): Promise<RawState> {
  const [o, e, i, p] = await Promise.all([
    db.from('orders').select('*').order('created_at_ms', { ascending: false }),
    db.from('expenses').select('*').order('created_at_ms', { ascending: false }),
    db.from('inventory').select('*'),
    db.from('custom_profits').select('*').order('created_at_ms', { ascending: false }),
  ]);
  const firstErr = o.error || e.error || i.error;
  if (firstErr) throw new HttpError(502, 'db_read_failed', 'تعذر قراءة البيانات من قاعدة البيانات', firstErr.message);

  const invRows = (i.data || []) as any[];
  const settingsRow = invRows.find((r) => r.id === SETTINGS_ROW_ID);
  const { settings, system } = parseSettingsRow(settingsRow);

  return {
    data: {
      orders: (o.data || []).map(rowToOrder),
      expenses: (e.data || []).map(rowToExpense),
      inventory: invRows.filter((r) => !String(r.id).startsWith('__') && r.category !== SYSTEM_CATEGORY).map(rowToFabric),
      customProfits: p.error ? [] : (p.data || []).map(rowToProfit),
      capital: Number(system.capital) || 0,
      settings,
    },
    system,
    settingsRowExists: Boolean(settingsRow),
  };
}

/** Reads full state strictly from the database. No seeds or hardcoded fallbacks. */
async function loadAll(db: SupabaseClient, _userId: string): Promise<StoreData> {
  const raw = await readRaw(db);
  return raw.data;
}

async function applyEntity(db: SupabaseClient, userId: string, entity: Entity, upsertItems: unknown, deleteIds: unknown) {
  const def = ENTITY[entity];
  const up = Array.isArray(upsertItems) ? upsertItems : [];
  const del = Array.isArray(deleteIds) ? deleteIds : [];
  if (up.length > MAX_ITEMS_PER_REQUEST || del.length > MAX_ITEMS_PER_REQUEST) {
    throw new HttpError(413, 'too_many_items', 'عدد العناصر في الطلب كبير جداً');
  }
  const clean = up.map(def.sanitize);
  if (clean.some((x) => !x)) throw new HttpError(400, 'invalid_item', 'بيانات غير صالحة في الطلب');
  const ids = del.map(cleanId);
  if (ids.some((x) => !x)) throw new HttpError(400, 'invalid_id', 'معرّف غير صالح في الطلب');

  if (clean.length) {
    const { error } = await db.from(def.table).upsert(clean.map((x) => def.toRow(x, userId)), { onConflict: 'id' });
    if (error) throw new HttpError(502, 'db_write_failed', 'تعذر الحفظ في قاعدة البيانات', error.message);
  }
  if (ids.length) {
    let q = db.from(def.table).delete().in('id', ids as string[]);
    if (entity === 'inventory') q = q.neq('category', SYSTEM_CATEGORY);
    const { error } = await q;
    if (error) throw new HttpError(502, 'db_write_failed', 'تعذر الحذف من قاعدة البيانات', error.message);
  }
}

/** One-time import of data that older app versions kept only in the browser (insert-missing-only, never overwrites). */
async function migrateLegacy(db: SupabaseClient, userId: string, legacy: any) {
  if (!legacy || typeof legacy !== 'object') return;
  const raw = await readRaw(db);
  const take = (arr: unknown) => (Array.isArray(arr) ? arr.slice(0, MAX_LEGACY_ITEMS) : []);
  const deletedExpenseIds = new Set(take(legacy.deletedExpenseIds).map(String));

  const plan: Array<[Entity, any[], Set<string>]> = [
    ['orders', take(legacy.orders), new Set(raw.data.orders.map((x) => x.id))],
    ['customProfits', take(legacy.customProfits), new Set(raw.data.customProfits.map((x) => x.id))],
    ['inventory', take(legacy.inventory), new Set(raw.data.inventory.map((x) => x.id))],
    ['expenses', take(legacy.expenses).filter((x: any) => !deletedExpenseIds.has(String(x?.id))), new Set(raw.data.expenses.map((x) => x.id))],
  ];

  for (const [entity, items, existing] of plan) {
    const def = ENTITY[entity];
    const fresh = items.map(def.sanitize).filter((x: any) => x && !existing.has(x.id));
    for (let i = 0; i < fresh.length; i += MAX_ITEMS_PER_REQUEST) {
      const chunk = fresh.slice(i, i + MAX_ITEMS_PER_REQUEST);
      const { error } = await db.from(def.table).upsert(chunk.map((x: any) => def.toRow(x, userId)), { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new HttpError(502, 'db_write_failed', 'تعذر نقل البيانات القديمة إلى قاعدة البيانات', error.message);
    }
  }

  const system: SystemState = { ...raw.system };
  const legacyExpenses = plan[3][1];
  if (legacyExpenses.length > 0) system.seededExpensesV1 = true; // the browser copy already contained the founder expenses
  const legacyCapital = Number(legacy.capital);
  if (system.capital === undefined && Number.isFinite(legacyCapital) && legacyCapital > 0) system.capital = legacyCapital;
  if (JSON.stringify(system) !== JSON.stringify(raw.system)) await writeSettingsRow(db, userId, raw.data.settings, system);
}

// ============================================================================
// Route handlers
// ============================================================================
function isAdmin(user: User): boolean {
  const email = (user.email || '').toLowerCase();
  return (email !== '' && ADMIN_EMAILS.includes(email)) || ADMIN_UIDS.includes(user.id);
}

async function requireAdmin(req: any): Promise<{ db: SupabaseClient; user: User }> {
  const ip = clientIp(req);
  const rawAuth = header(req, 'authorization');
  const token = rawAuth.replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length < 20) {
    rateLimit(`authfail:${ip}`, 30, 10 * 60_000);
    throw new HttpError(401, 'unauthenticated', 'يجب تسجيل الدخول');
  }
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    rateLimit(`authfail:${ip}`, 30, 10 * 60_000);
    throw new HttpError(401, 'invalid_session', 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً');
  }
  if (!isAdmin(data.user)) {
    console.warn(`[nasjah-api] forbidden user ${data.user.id} from ${ip}`);
    rateLimit(`authfail:${ip}`, 30, 10 * 60_000);
    throw new HttpError(403, 'forbidden', 'غير مصرح لهذا الحساب بالوصول');
  }
  return { db: serviceClient || userScopedClient(token), user: data.user };
}

const MODE = () => (HAS_SERVICE_ROLE ? 'service' : 'user-jwt');

async function handleAdmin(req: any, res: any) {
  const ip = clientIp(req);
  rateLimit(`admin:${ip}`, 240, 60_000);
  assertSameOrigin(req);
  const { db, user } = await requireAdmin(req);

  if (req.method === 'GET') {
    const data = await loadAll(db, user.id);
    return send(res, 200, { ok: true, mode: MODE(), serverTime: NOW(), data });
  }
  if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'طريقة غير مسموحة');

  rateLimit(`admin-write:${ip}`, 120, 60_000);
  const body = parseBody(req);
  const action = String(body.action || '');

  switch (action) {
    case 'apply': {
      const entity = body.entity as Entity;
      if (!ENTITY[entity]) throw new HttpError(400, 'bad_entity', 'نوع بيانات غير معروف');
      await applyEntity(db, user.id, entity, body.upsert, body.delete);
      break;
    }
    case 'settings': {
      const raw = await readRaw(db);
      const next = sanitizeSettings(body.settings, raw.data.settings);
      next.updatedAt = NOW();
      await writeSettingsRow(db, user.id, next, raw.system);
      break;
    }
    case 'capital': {
      const amount = num(body.amount, 0, 100_000_000, NaN);
      if (!Number.isFinite(amount)) throw new HttpError(400, 'bad_amount', 'مبلغ غير صالح');
      const raw = await readRaw(db);
      await writeSettingsRow(db, user.id, raw.data.settings, { ...raw.system, capital: amount });
      break;
    }
    case 'migrate': {
      await migrateLegacy(db, user.id, body.legacy);
      break;
    }
    case 'reset': {
      if (body.confirm !== 'RESET_ORDERS_AND_EXPENSES') throw new HttpError(400, 'confirm_required', 'تأكيد الحذف مطلوب');
      const [a, b] = await Promise.all([
        db.from('orders').delete().not('id', 'is', null),
        db.from('expenses').delete().not('id', 'is', null),
      ]);
      const err = a.error || b.error;
      if (err) throw new HttpError(502, 'db_write_failed', 'تعذر حذف البيانات', err.message);
      console.warn(`[nasjah-api] RESET by ${user.id} from ${ip}`);
      break;
    }
    default:
      throw new HttpError(400, 'bad_action', 'عملية غير معروفة');
  }

  const data = await loadAll(db, user.id);
  return send(res, 200, { ok: true, mode: MODE(), serverTime: NOW(), data });
}

const isPackaging = (item: { category?: string; name?: string }) => {
  const cat = String(item.category || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  if (cat === 'تغليف' || /تغليف|packaging|علب|كرتون/.test(cat)) return true;
  return /تغليف|بوكس|علبة|علب|كرتون|أكياس|كيس|شريط|شرائط/i.test(name);
};

async function handlePublicStore(req: any, res: any) {
  if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed', 'طريقة غير مسموحة');
  rateLimit(`store:${clientIp(req)}`, 120, 60_000);
  const db = serviceClient || authClient;
  const { data, error } = await db.from('inventory').select('id,name,quantity,category,image_url,barcode');
  if (error) throw new HttpError(502, 'db_read_failed', 'تعذر تحميل الأقمشة حالياً', error.message);

  const rows = (data || []) as any[];
  const { settings } = parseSettingsRow(rows.find((r) => r.id === SETTINGS_ROW_ID));
  const catalog = rows
    .filter((r) => !String(r.id).startsWith('__') && r.category !== SYSTEM_CATEGORY)
    .map(rowToFabric)
    .filter((f) => !isPackaging(f))
    .map((f) => {
      const isCatalog = f.sourcingType === 'catalog';
      const qty = f.quantity;
      // Public projection: never expose cost price, supplier, catalog codes or exact stock levels.
      return {
        id: f.id,
        name: f.name,
        price: f.price,
        isAvailable: isCatalog || qty >= CRITICAL_FABRIC_THRESHOLD,
        isLowStock: !isCatalog && qty > 0 && qty <= CRITICAL_FABRIC_THRESHOLD,
        isOutOfStock: !isCatalog && qty <= 0,
        category: f.category || 'أقمشة رجالية',
        imageUrl: f.imageUrl || '',
        season: f.season || '',
        description: f.description || '',
      };
    });
  return send(res, 200, { ok: true, settings, catalog, serverTime: NOW() });
}

// ============================================================================
// Entry point
// ============================================================================
export default async function handler(req: any, res: any) {
  setApiHeaders(res);
  const route = resolveRoute(req);
  try {
    switch (route) {
      case 'health': {
        const db = serviceClient || authClient;
        const [eRes, pRes] = await Promise.all([
          db.from('expenses').select('*'),
          db.from('custom_profits').select('*'),
        ]);
        return send(res, 200, {
          ok: true,
          version: API_VERSION,
          secureMode: HAS_SERVICE_ROLE,
          time: NOW(),
          expensesCount: (eRes.data || []).length,
          expenses: eRes.data || [],
          customProfits: pRes.data || [],
        });
      }
      case 'store':
        return await handlePublicStore(req, res);
      case 'admin':
        return await handleAdmin(req, res);
      default:
        throw new HttpError(404, 'not_found', 'المسار غير موجود');
    }
  } catch (err: any) {
    if (err instanceof HttpError) {
      if (err.status >= 500) console.error(`[nasjah-api] ${route} ${err.code}: ${err.detail || err.message}`);
      return send(res, err.status, { ok: false, code: err.code, error: err.message, detail: err.detail });
    }
    console.error(`[nasjah-api] ${route} unexpected:`, err);
    return send(res, 500, { ok: false, code: 'internal', error: 'خطأ داخلي في الخادم' });
  }
}
