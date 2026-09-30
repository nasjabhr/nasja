export interface Fabric {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  image?: string;
  barcode?: string;
  category?: string;
  season?: string; // صيفي، شتوي، ربيعي، كافة الفصول
  description?: string; // معلومات إضافية للمنتج (المواصفات، الملمس، بلد الصنع...)
}

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
  updatedAt?: number;
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
  updatedAt: 0,
};

export type OrderStatus = 'قيد التجهيز' | 'جاهز للتسليم' | 'تم التسليم' | 'ملغي';
export type PaymentStatus = 'تم الدفع' | 'قيد الدفع';
export type PaymentMethod = 'بنفت بي' | 'نقداً' | 'بطاقة دفع' | 'أخرى';
export type DeliveryType = 'قدوم شخصي' | 'توصيل';
export type DeliveryZone = 'قريب' | 'متوسط' | 'بعيد';

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  details: string;
  price: number;
  total?: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod | string;
  deliveryMethod?: string;
  deliveryType?: DeliveryType | string;
  deliveryZone?: DeliveryZone | string;
  deliveryFee?: number;
  notes?: string;
  createdAt: number; // timestamp in ms
  fabricId?: string;
  fabricMeters?: number;
  fabricName?: string;
}

export interface CustomProfit {
  id: string;
  amount: number;
  description: string;
  category?: string;
  date?: string;
  createdAt: number; // timestamp in ms
}

export const CRITICAL_FABRIC_THRESHOLD = 3.0;

export const isOrderPaid = (order: { paymentStatus?: PaymentStatus | string; status?: OrderStatus | string }): boolean => {
  return order.paymentStatus !== 'قيد الدفع' && order.status !== 'ملغي';
};

export const isOrderValidRevenue = (order: { paymentStatus?: PaymentStatus | string; status?: OrderStatus | string }): boolean => {
  return order.paymentStatus !== 'قيد الدفع' && order.status !== 'ملغي';
};

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  paymentMethod?: PaymentMethod | string;
  paidTo?: string;
  notes?: string;
  createdAt: number; // timestamp in ms
}
