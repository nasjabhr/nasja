-- ==========================================================
-- دار نَسْجة (Nasjah) - سكربت تحديث وإنشاء قاعدة بيانات Supabase بالكامل
-- قم بنسخ هذا الكود بالكامل ولصقه في:
-- Supabase Dashboard -> SQL Editor -> New query -> Run
-- ==========================================================

-- 1. جدول الطلبات (Orders) مع دعم آلية الاستلام ورسوم التوصيل
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    customer_name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    details TEXT DEFAULT '',
    price NUMERIC(10,3) DEFAULT 0,
    total NUMERIC(10,3) DEFAULT 0,
    status TEXT DEFAULT 'قيد التجهيز',
    payment_status TEXT DEFAULT 'تم الدفع',
    payment_method TEXT DEFAULT 'بنفت بي',
    delivery_method TEXT DEFAULT '',
    delivery_type TEXT DEFAULT 'قدوم شخصي',
    delivery_zone TEXT DEFAULT '',
    delivery_fee NUMERIC(10,3) DEFAULT 0,
    fabric_id TEXT DEFAULT '',
    fabric_meters NUMERIC(10,2) DEFAULT 0,
    fabric_name TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at_ms BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- إذا كان جدول orders منشأ مسبقاً، نقوم بإضافة الأعمدة الجديدة بأمان
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'قدوم شخصي',
ADD COLUMN IF NOT EXISTS delivery_zone TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fabric_id TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS fabric_meters NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fabric_name TEXT DEFAULT '';

-- 2. جدول الأرباح الإضافية واليدوية (Custom Profits)
CREATE TABLE IF NOT EXISTS public.custom_profits (
    id TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    amount NUMERIC(10,3) NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    category TEXT DEFAULT 'أرباح إضافية',
    date TEXT DEFAULT '',
    created_at_ms BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. جدول المصروفات (Expenses)
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    description TEXT NOT NULL,
    amount NUMERIC(10,3) DEFAULT 0,
    category TEXT DEFAULT 'أقمشة ومواد خام',
    payment_method TEXT DEFAULT 'بنفت بي',
    paid_to TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at_ms BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. جدول المخزون والأقمشة والتغليف (Inventory)
-- ملاحظة: السعر مخصص للأقمشة فقط للمتر، بينما مواد التغليف تتابع بالعدد والكمية
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    name TEXT NOT NULL,
    quantity NUMERIC(10,2) DEFAULT 0,
    price NUMERIC(10,3) DEFAULT 0,
    category TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    barcode TEXT DEFAULT '',
    season TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. تفعيل حماية أمان مستوى الصفوف (Row Level Security - RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_profits ENABLE ROW LEVEL SECURITY;

-- 6. سياسات الأمان: السماح بعرض وإدارة البيانات لدار نَسْجَة بدون حجب
DROP POLICY IF EXISTS "Users can manage their own orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
CREATE POLICY "Public can view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Public can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can manage their own orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Public can view expenses" ON public.expenses;
CREATE POLICY "Public can view expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Users can manage their own expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Public can view inventory" ON public.inventory;
CREATE POLICY "Public can view inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Users can manage their own inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their custom profits" ON public.custom_profits;
DROP POLICY IF EXISTS "Public can view custom profits" ON public.custom_profits;
CREATE POLICY "Public can view custom profits" ON public.custom_profits FOR SELECT USING (true);
CREATE POLICY "Users can manage their custom profits" ON public.custom_profits FOR ALL USING (true) WITH CHECK (true);

-- 8. جدول إعدادات متجر الزبائن (Store Settings)
CREATE TABLE IF NOT EXISTS public.store_settings (
    user_id UUID PRIMARY KEY DEFAULT auth.uid(),
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their store settings" ON public.store_settings;
CREATE POLICY "Users can manage their store settings" ON public.store_settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings" ON public.store_settings
    FOR SELECT USING (true);

