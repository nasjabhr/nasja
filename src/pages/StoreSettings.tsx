import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Store, 
  Phone, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink, 
  Sparkles, 
  ShieldCheck, 
  Instagram, 
  Sun, 
  Snowflake, 
  Leaf, 
  Layers, 
  Sliders, 
  RefreshCw,
  Eye,
  Scissors
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StoreSettings, DEFAULT_STORE_SETTINGS } from '../types';
import { getLocalStoreSettings, persistStoreSettings, syncWithServer, EVENT_STORE_SETTINGS_UPDATED } from '../lib/dataService';
import { supabase } from '../lib/supabase';
import WhatsAppIcon from '../components/WhatsAppIcon';
import NasjahLogo from '../components/NasjahLogo';

export default function StoreSettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>(() => getLocalStoreSettings());
  const settingsRef = useRef<StoreSettings>(settings);
  settingsRef.current = settings;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isDirtyRef = useRef(false);
  const lastSavedTimeRef = useRef<number>(0);

  // Fetch current store settings on mount
  useEffect(() => {
    // 1. Initial local load
    const cached = getLocalStoreSettings();
    if (cached) {
      setSettings(cached);
      settingsRef.current = cached;
    }

    async function loadSettings() {
      let candidate: StoreSettings | null = null;

      // A. Direct Supabase Cloud load (works seamlessly on Vercel and all frontends)
      if (supabase) {
        try {
          const { data: invRow } = await supabase
            .from('inventory')
            .select('image_url')
            .eq('id', '__store_settings__')
            .maybeSingle();

          if (invRow?.image_url) {
            try {
              const parsed = JSON.parse(invRow.image_url);
              if (parsed && typeof parsed === 'object') {
                candidate = {
                  ...DEFAULT_STORE_SETTINGS,
                  ...parsed,
                  seasonsOrder: parsed.seasonsOrder && parsed.seasonsOrder.length > 0 
                    ? parsed.seasonsOrder 
                    : ['winter', 'summer', 'spring']
                };
              }
            } catch {}
          }
        } catch {}
      }

      // B. Direct server API load (when running with Express backend)
      try {
        const res = await fetch(`/api/store-settings?t=${Date.now()}`);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data?.settings) {
              const serverTime = data.settings.updatedAt || 0;
              const candTime = candidate?.updatedAt || 0;
              if (!candidate || serverTime >= candTime) {
                candidate = {
                  ...DEFAULT_STORE_SETTINGS,
                  ...(candidate || {}),
                  ...data.settings,
                  seasonsOrder: data.settings.seasonsOrder && data.settings.seasonsOrder.length > 0 
                    ? data.settings.seasonsOrder 
                    : ['winter', 'summer', 'spring']
                };
              }
            }
          }
        }
      } catch {}

      // Only apply if user is NOT actively typing and candidate is newer than local
      if (candidate && !isDirtyRef.current) {
        const candTime = candidate.updatedAt || 0;
        const currTime = settingsRef.current?.updatedAt || 0;
        if (candTime > currTime && candTime > 0) {
          setSettings(candidate);
          settingsRef.current = candidate;
          try {
            localStorage.setItem('nasjah_store_settings', JSON.stringify(candidate));
          } catch {}
        }
      }
    }

    loadSettings();

    // Listen for updates from other tabs or background sync: only accept if newer and user not typing
    const handleUpdate = (e: any) => {
      if (isDirtyRef.current) return;
      if (e?.detail) {
        const incomingTime = e.detail.updatedAt || 0;
        const currentTime = settingsRef.current?.updatedAt || 0;
        if (incomingTime > currentTime && incomingTime > 0) {
          setSettings(e.detail);
          settingsRef.current = e.detail;
        }
      }
    };
    window.addEventListener(EVENT_STORE_SETTINGS_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENT_STORE_SETTINGS_UPDATED, handleUpdate);
  }, []);

  const updateSettingField = <K extends keyof StoreSettings>(field: K, value: StoreSettings[K]) => {
    isDirtyRef.current = true;
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const seasonLabels: Record<string, string> = {
    winter: 'أقمشة شتوية ❄️',
    summer: 'أقمشة صيفية ☀️',
    spring: 'أقمشة ربيعية 🌿',
  };

  const moveSeason = (index: number, direction: 'up' | 'down') => {
    isDirtyRef.current = true;
    const currentOrder = [...(settings.seasonsOrder || ['winter', 'summer', 'spring'])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;
    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[targetIndex];
    currentOrder[targetIndex] = temp;
    setSettings({ ...settings, seasonsOrder: currentOrder });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const now = Date.now();
      lastSavedTimeRef.current = now;
      const toSave = { ...settings, updatedAt: now };

      // Multi-layer persistence across Supabase, LocalStorage, and Backend
      const updated = await persistStoreSettings(toSave);
      setSettings(updated);
      settingsRef.current = updated;
      isDirtyRef.current = false;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: any) {
      console.error('Failed to save settings', err);
      setSaveError('حدث خطأ أثناء حفظ الإعدادات، يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  // Format WhatsApp Link for preview
  const cleanPhone = (settings.whatsappNumber || '38244795').replace(/[^0-9]/g, '');
  const normalizedWaNumber = cleanPhone.startsWith('973') ? cleanPhone : `973${cleanPhone}`;
  const previewWaUrl = `https://wa.me/${normalizedWaNumber}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans text-right" dir="rtl">
      
      {/* Header Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#C7B895]/30 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#1D3A30] text-[#E8D5A8] flex items-center justify-center shadow-sm">
            <Sliders className="w-6 h-6 text-[#C7B895]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-[#1D3A30]">إعدادات متجر الزبائن</h1>
              <span className="bg-[#C7B895]/20 text-[#1D3A30] text-[11px] font-bold px-2 py-0.5 rounded-md border border-[#C7B895]/40">
                مباشر
              </span>
            </div>
            <p className="text-xs text-[#1D3A30]/65 mt-0.5">
              تحكم برقم التواصل، هوية المتجر، عرض المواسم، وطريقة ظهور الأقمشة للزبائن
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            to="/store"
            target="_blank"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FAF7F0] hover:bg-[#F2ECE0] text-[#1D3A30] text-xs font-bold border border-[#C7B895]/40 transition active:scale-95"
            title="معاينة المتجر المباشر"
          >
            <Eye className="w-4 h-4 text-[#A99872]" />
            <span>معاينة المتجر</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#1D3A30]/50 mr-1" />
          </Link>

          <Link
            to="/settings"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#25493D]/10 hover:bg-[#25493D]/20 text-[#1D3A30] text-xs font-bold transition active:scale-95"
            title="الأمان والأجهزة المتصلة"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">الأمان</span>
          </Link>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-xs font-bold">
              تم حفظ إعدادات متجر الزبائن بنجاح! تم تحديث رقم التواصل والمواسم تلقائياً.
            </p>
          </div>
          <Link
            to="/store"
            target="_blank"
            className="text-xs font-black text-emerald-800 underline hover:text-emerald-950 flex-shrink-0"
          >
            مشاهدة المتجر الآن
          </Link>
        </motion.div>
      )}

      {/* Error Notification */}
      {saveError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <p className="text-xs font-bold">{saveError}</p>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-xs font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
          >
            إغلاق
          </button>
        </motion.div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#C7B895]/30">
          <RefreshCw className="w-8 h-8 text-[#1D3A30] animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-[#1D3A30]/70">جارِ تحميل الإعدادات الحالية...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* ========================================================================= */}
          {/* 1. CUSTOMER CONTACT WHATSAPP NUMBER                                       */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#C7B895]/30 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#C7B895]/20">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <WhatsAppIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#1D3A30]">رقم التحدث والتواصل مع الزبائن (واتساب)</h2>
                <p className="text-[11px] text-[#1D3A30]/65">
                  هذا الرقم هو المعتمد في كافة أزرار الطلب والاستفسار وحاسبة أمتار الأقمشة في المتجر
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-xs font-bold text-[#1D3A30] mb-1.5">
                  رقم الهاتف أو الواتساب (مملكة البحرين) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={settings.whatsappNumber}
                    onChange={(e) => updateSettingField('whatsappNumber', e.target.value)}
                    placeholder="مثال: 38244795"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-2 focus:ring-[#1D3A30] outline-none text-sm font-bold font-mono text-[#1D3A30]"
                    dir="ltr"
                  />
                  <Phone className="w-4 h-4 text-[#C7B895] absolute right-3 top-3" />
                </div>
                <p className="text-[10px] text-[#1D3A30]/60 mt-1">
                  الرقم المعتمد حالياً: <span className="font-mono font-bold text-[#1D3A30]">{settings.whatsappNumber || '38244795'}</span>
                </p>
              </div>

              {/* WhatsApp Link Live Box */}
              <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1D3A30]">رابط المحادثة المتولد للزبون:</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                    جاهز ونشط
                  </span>
                </div>
                <div className="font-mono text-xs text-[#1D3A30] bg-white p-2 rounded-lg border border-[#C7B895]/20 truncate" dir="ltr">
                  {previewWaUrl}
                </div>
                <a
                  href={`${previewWaUrl}?text=${encodeURIComponent('تجربة محادثة واتساب متجر نَسْجَة للأقمشة الرجالية')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-bold hover:underline"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                  <span>اختبار فتح المحادثة للرقم ({settings.whatsappNumber})</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. STORE IDENTITY & ANNOUNCEMENTS                                         */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#C7B895]/30 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#C7B895]/20">
              <div className="w-9 h-9 rounded-xl bg-[#FAF7F0] text-[#1D3A30] flex items-center justify-center border border-[#C7B895]/30">
                <Store className="w-5 h-5 text-[#A99872]" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#1D3A30]">هوية المتجر وشريط الإعلان</h2>
                <p className="text-[11px] text-[#1D3A30]/65">
                  العناوين والشعارات المعروضة في ترويسة المتجر لزوار الموقع
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1D3A30] mb-1.5">
                  اسم المتجر المعروض *
                </label>
                <input
                  type="text"
                  required
                  value={settings.storeName}
                  onChange={(e) => updateSettingField('storeName', e.target.value)}
                  placeholder="نَسْجَة"
                  className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30] font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1D3A30] mb-1.5">
                  الشعار أو الوصف الفرعي
                </label>
                <input
                  type="text"
                  value={settings.storeTagline}
                  onChange={(e) => updateSettingField('storeTagline', e.target.value)}
                  placeholder="أقمشة رجالية فاخرة ومختارة بعناية"
                  className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                />
              </div>
            </div>

            {/* Announcement Banner */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#1D3A30]">
                  نص شريط الإعلان في أعلى المتجر
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[#1D3A30]/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.headerVisible}
                    onChange={(e) => updateSettingField('headerVisible', e.target.checked)}
                    className="w-4 h-4 accent-[#1D3A30] rounded cursor-pointer"
                  />
                  <span>إظهار شريط الإعلان</span>
                </label>
              </div>
              <input
                type="text"
                value={settings.announcementText}
                onChange={(e) => updateSettingField('announcementText', e.target.value)}
                placeholder="أرقى خامات الأقمشة الرجالية المختارة بعناية فائقة • متوفرة بالقطعة وطاقة القماش"
                className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
              />
            </div>

            {/* Instagram Account */}
            <div>
              <label className="block text-xs font-bold text-[#1D3A30] mb-1.5">
                حساب إنستغرام الخاص بالمتجر
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={settings.instagramHandle}
                  onChange={(e) => updateSettingField('instagramHandle', e.target.value)}
                  placeholder="nasjah.bh"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-mono text-[#1D3A30]"
                  dir="ltr"
                />
                <Instagram className="w-4 h-4 text-[#C7B895] absolute right-3 top-3" />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. SEASONAL CATALOG & DISPLAY SETTINGS                                    */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#C7B895]/30 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#C7B895]/20">
              <div className="w-9 h-9 rounded-xl bg-[#FAF7F0] text-[#1D3A30] flex items-center justify-center border border-[#C7B895]/30">
                <Layers className="w-5 h-5 text-[#A99872]" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#1D3A30]">خيارات المواسم وعرض الأقمشة</h2>
                <p className="text-[11px] text-[#1D3A30]/65">
                  تحديد الموسم الافتراضي وخيارات إخفاء المخزون وحاسبة الأمتار
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Default Season */}
              <div>
                <label className="block text-xs font-bold text-[#1D3A30] mb-1.5">
                  الموسم المعروض افتراضياً عند فتح المتجر:
                </label>
                <select
                  value={settings.defaultSeason}
                  onChange={(e) => updateSettingField('defaultSeason', e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-bold text-[#1D3A30] bg-white cursor-pointer"
                >
                  <option value="all">جميع الأقمشة (الافتراضي)</option>
                  <option value="winter">أقمشة شتوية</option>
                  <option value="summer">أقمشة صيفية</option>
                  <option value="spring">أقمشة ربيعية</option>
                </select>
                <p className="text-[10px] text-[#1D3A30]/60 mt-1">
                  يمكن للزبون التبديل بين الأقسام في أي وقت من قائمة الخيارات.
                </p>
              </div>

              {/* Standard Thobe Meters */}
              <div>
                <label className="block text-xs font-bold text-[#1D3A30] mb-1.5">
                  أمتار الثوب الرجالي القياسي الافتراضية:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    value={settings.defaultThobeMeters}
                    onChange={(e) => updateSettingField('defaultThobeMeters', parseFloat(e.target.value) || 3.5)}
                    className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-bold font-mono text-[#1D3A30]"
                  />
                  <span className="text-xs font-bold text-[#1D3A30]/70 flex-shrink-0">متر</span>
                </div>
                <p className="text-[10px] text-[#1D3A30]/60 mt-1">
                  المقاس المعتمد للثوب الرجالي هو 3.50 متر.
                </p>
              </div>
            </div>

            {/* Reorder Seasons in Storefront */}
            <div className="pt-3 border-t border-[#C7B895]/20 space-y-2">
              <label className="block text-xs font-black text-[#1D3A30]">
                ترتيب ظهور أقسام الأقمشة في المتجر (من الأول للآخر):
              </label>
              <p className="text-[11px] text-[#1D3A30]/65">
                يمكنك تقديم الأقمشة الشتوية أو الصيفية أو الربيعية لتظهر أولاً في واجهة المتجر للزبائن:
              </p>
              <div className="space-y-2 mt-2">
                {(settings.seasonsOrder || ['winter', 'summer', 'spring']).map((sKey, idx) => (
                  <div
                    key={sKey}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/30 text-xs font-bold text-[#1D3A30]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-xl bg-[#1D3A30] text-[#E8D5A8] flex items-center justify-center text-xs font-mono font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black">{seasonLabels[sKey] || sKey}</span>
                      <span className="text-[10px] text-[#A99872] font-normal">
                        {idx === 0 ? '(يظهر في المقدمة)' : idx === 1 ? '(يظهر ثانياً)' : '(يظهر ثالثاً)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSeason(idx, 'up')}
                        className="px-2.5 py-1 bg-white border border-[#C7B895]/40 rounded-xl text-[11px] font-bold text-[#1D3A30] hover:bg-[#FAF7F0] disabled:opacity-30 cursor-pointer transition shadow-2xs"
                      >
                        ↑ تقديم للأعلى
                      </button>
                      <button
                        type="button"
                        disabled={idx === (settings.seasonsOrder || []).length - 1}
                        onClick={() => moveSeason(idx, 'down')}
                        className="px-2.5 py-1 bg-white border border-[#C7B895]/40 rounded-xl text-[11px] font-bold text-[#1D3A30] hover:bg-[#FAF7F0] disabled:opacity-30 cursor-pointer transition shadow-2xs"
                      >
                        ↓ تأخير للأسفل
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Out-of-Stock Toggle */}
            <div className="pt-2 border-t border-[#C7B895]/20">
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.hideOutOfStock}
                  onChange={(e) => updateSettingField('hideOutOfStock', e.target.checked)}
                  className="w-4 h-4 accent-[#1D3A30] rounded cursor-pointer"
                />
                <div>
                  <p className="text-xs font-bold text-[#1D3A30]">إخفاء الأقمشة النافذة من المخزون</p>
                  <p className="text-[11px] text-[#1D3A30]/60">
                    عند التفعيل، لن تظهر أي أقمشة كميتها صفر في متجر الزبائن العام.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SAVE BUTTON BAR                                                           */}
          {/* ========================================================================= */}
          <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-[#C7B895]/40 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {saveSuccess ? (
                <div className="flex items-center gap-2 text-xs font-black text-emerald-800 bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-300 shadow-xs animate-pulse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>تم حفظ الإعدادات وتحديث المتجر فورياً في السحابة!</span>
                </div>
              ) : saveError ? (
                <div className="flex items-center gap-2 text-xs font-black text-rose-800 bg-rose-100 px-3.5 py-1.5 rounded-xl border border-rose-300 shadow-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{saveError}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-[#1D3A30]">
                    التعديلات تُطبق فوراً على متجر الزبائن السحابي
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-black rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-70 cursor-pointer w-full sm:w-auto ${
                  saveSuccess 
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white' 
                    : 'btn-primary-atelier'
                }`}
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#E8D5A8]" />
                ) : saveSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <Save className="w-4 h-4 text-[#E8D5A8]" />
                )}
                <span>
                  {saving ? 'جارِ الحفظ السحابي...' : saveSuccess ? 'تم الحفظ بنجاح ✓' : 'حفظ إعدادات المتجر'}
                </span>
              </button>
            </div>
          </div>

        </form>
      )}

    </div>
  );
}
