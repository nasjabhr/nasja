export type SourcingType = 'catalog' | 'stock';

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
  sourcingType?: SourcingType; // 'catalog' = دفتر عينات / بالطلب من المحل, 'stock' = مخزون فعلي بالأمتار
  supplierName?: string; // اسم المحل أو المورد (مثال: محل كاكولي، الخواجة...)
  catalogCode?: string; // رقم أو كود الدفتر / العينة (مثال: دفتر 2 - عينة 14)
  costPrice?: number; // سعر التكلفة / الشراء من المحل (د.ب)
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
  storeTagline: "أقمشة وخياطة رجالية",
  announcementText: "أقمشة وتفصيل حسب الطلب • جودة وخياطة مضمونة",
  instagramHandle: "nasjah.bh",
  defaultThobeMeters: 3.5,
  hideOutOfStock: false,
  defaultSeason: "all",
  headerVisible: true,
  seasonsOrder: ['winter', 'summer', 'spring'],
  updatedAt: 0,
};

export type OrderStatus = 'قيد التجهيز' | 'جاهز للتسليم' | 'تم التسليم' | 'ملغي';
export type PaymentStatus = 'تم الدفع' | 'قيد الدفع' | 'آجل';
export type PaymentMethod = 'بنفت بي' | 'نقداً' | 'بطاقة دفع' | 'أخرى';
export type DeliveryType = 'قدوم شخصي' | 'توصيل';

export type BahrainGovernorateName = 
  | 'المحافظة الشمالية'
  | 'محافظة العاصمة'
  | 'المحافظة الجنوبية'
  | 'محافظة المحرق';

export interface BahrainGovernorateInfo {
  name: BahrainGovernorateName;
  shortName: string;
  fee: number;
  feeLabel: string;
  areas: string[];
}

export const BAHRAIN_GOVERNORATES: Record<BahrainGovernorateName, BahrainGovernorateInfo> = {
  'المحافظة الشمالية': {
    name: 'المحافظة الشمالية',
    shortName: 'الشمالية',
    fee: 0.500,
    feeLabel: '0.500 د.ب (500 فلس)',
    areas: [
      'سار',
      'البديع',
      'الجنبية',
      'بني جمرة',
      'الدراز',
      'كرانة',
      'باربار',
      'الشاخورة',
      'القدم',
      'الهملة',
      'دمستان',
      'كرزكان',
      'المالكية',
      'صدد',
      'دار كليب',
      'مدينة سلمان'
    ]
  },
  'محافظة العاصمة': {
    name: 'محافظة العاصمة',
    shortName: 'العاصمة',
    fee: 1.000,
    feeLabel: '1.000 د.ب',
    areas: [
      'المنامة',
      'الجفير',
      'السيف',
      'السنابس',
      'الزنج',
      'العدلية',
      'القضيبية',
      'أم الحصم',
      'الماحوز',
      'توبلي',
      'جدعلي',
      'كرباباد',
      'البلاد القديم'
    ]
  },
  'المحافظة الجنوبية': {
    name: 'المحافظة الجنوبية',
    shortName: 'الجنوبية',
    fee: 1.000,
    feeLabel: '1.000 د.ب',
    areas: [
      'الرفاع الشرقي',
      'الرفاع الغربي',
      'مدينة عيسى',
      'سند',
      'النويدرات',
      'المعامير',
      'العكر',
      'سافرة',
      'عوالي',
      'الزلاق'
    ]
  },
  'محافظة المحرق': {
    name: 'محافظة المحرق',
    shortName: 'المحرق',
    fee: 2.000,
    feeLabel: '2.000 د.ب (المناطق البعيدة)',
    areas: [
      'المحرق',
      'قلالي',
      'البسيتين',
      'عراد',
      'ديار المحرق',
      'أمواج',
      'الحد',
      'الدير',
      'سماهيج'
    ]
  }
};

export type DeliveryZone = 'قريب' | 'متوسط' | 'بعيد' | BahrainGovernorateName;

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
  governorate?: BahrainGovernorateName | string;
  area?: string;
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
  return order.paymentStatus === 'تم الدفع' && order.status !== 'ملغي';
};

export const isOrderValidRevenue = (order: { paymentStatus?: PaymentStatus | string; status?: OrderStatus | string }): boolean => {
  return order.paymentStatus === 'تم الدفع' && order.status !== 'ملغي';
};

export const isOrderPendingPayment = (order: { paymentStatus?: PaymentStatus | string; status?: OrderStatus | string }): boolean => {
  return (order.paymentStatus === 'قيد الدفع' || order.paymentStatus === 'آجل') && order.status !== 'ملغي';
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
