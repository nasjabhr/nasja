import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  Scissors,
  Instagram, 
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Snowflake,
  Sun,
  Leaf,
  Layers,
  Sparkles,
  Truck,
  User,
  ArrowUp,
  CheckCircle2,
  RotateCw
} from 'lucide-react';
import NasjahLogo from '../components/NasjahLogo';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { CRITICAL_FABRIC_THRESHOLD, StoreSettings, DEFAULT_STORE_SETTINGS, BahrainGovernorateName, BAHRAIN_GOVERNORATES } from '../types';
import { getLocalStoreSettings, fetchPublicStore, EVENT_STORE_SETTINGS_UPDATED } from '../lib/dataService';

export interface PublicFabric {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isAvailable: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  category: string;
  imageUrl: string;
  season?: string;
  description?: string;
}

export function formatMeters(meters: number): string {
  const rounded = Math.round(Number(meters || 0) * 2) / 2;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

export type SeasonKey = 'winter' | 'summer' | 'spring';
export type SeasonFilter = 'all' | SeasonKey;

// Fabric Length Options: Custom at top, followed by ascending meters from least to most
const FABRIC_LENGTH_OPTIONS = [
  { id: 'custom', label: 'تحديد أمتار مخصصة (مخصص)', meters: 3.5, note: 'طلب عدد أمتار مخصص بدقة حسب رغبتك' },
  { id: 'cut_youth', label: 'قصة أولاد / شباب (2.5 م)', meters: 2.50, note: 'قطعة قماش كافية لثوب شبابي' },
  { id: 'cut_classic', label: 'قصة قياسية معتادة (3.5 م)', meters: 3.50, note: 'القطعة الأكثر طلباً كافية لثوب رجالي كامل' },
  { id: 'cut_wide', label: 'قصة وافية / راهية (4.0 م)', meters: 4.00, note: 'قطعة وافية للمقاسات الكبيرة والفضفاضة' },
  { id: 'fabric_roll', label: 'طاقة قماش كاملة (22.5 م)', meters: 22.50, note: 'طاقة توب كاملة مغلقة من المصنع (22.5 متر)' },
];

const SEASON_META: Record<SeasonKey, { title: string; icon: any }> = {
  winter: { title: 'الأقمشة الشتوية', icon: Snowflake },
  summer: { title: 'الأقمشة الصيفية', icon: Sun },
  spring: { title: 'الأقمشة الربيعية', icon: Leaf },
};

// Packaging filter helper - strictly excludes boxes, bags, ribbons and wrapping supplies
const isPackagingItem = (item: any): boolean => {
  if (!item) return false;
  if (item.category === 'تغليف') return true;
  const cat = String(item.category || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  if (cat.includes('تغليف') || cat.includes('packaging') || cat.includes('علب') || cat.includes('كرتون')) return true;
  if (/تغليف|بوكس|علبة|علب|كرتون|أكياس|كيس|شريط|شرائط/i.test(name)) return true;
  return false;
};

export default function Store() {
  const [catalog, setCatalog] = useState<PublicFabric[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => getLocalStoreSettings());
  const [loading, setLoading] = useState(true);

  // Live update if settings change in admin
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setStoreSettings(e.detail);
      } else {
        setStoreSettings(getLocalStoreSettings());
      }
    };
    window.addEventListener(EVENT_STORE_SETTINGS_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENT_STORE_SETTINGS_UPDATED, handleUpdate);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<SeasonFilter>('all');
  const [selectedFabric, setSelectedFabric] = useState<PublicFabric | null>(null);
  
  // 3-dots Menu State
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Accordion / Collapsible state for sub-categories under "جميع الأقمشة"
  // Default is expanded (ظاهرين في الحالة الطبيعية)
  const [isAllFabricsExpanded, setIsAllFabricsExpanded] = useState(true);

  // Modal length choice calculation
  const [tailorChoice, setTailorChoice] = useState<string>('cut_classic');
  const [customMeters, setCustomMeters] = useState<number>(3.5);
  const [deliveryType, setDeliveryType] = useState<'قدوم شخصي' | 'توصيل'>('قدوم شخصي');
  const [selectedGovernorate, setSelectedGovernorate] = useState<BahrainGovernorateName>('المحافظة الشمالية');
  const [selectedArea, setSelectedArea] = useState<string>('سار');
  const [addressDetails, setAddressDetails] = useState<string>('');

  const deliveryFee = useMemo(() => {
    if (deliveryType === 'قدوم شخصي') return 0;
    return BAHRAIN_GOVERNORATES[selectedGovernorate]?.fee ?? 0.50;
  }, [deliveryType, selectedGovernorate]);

  // Contact WhatsApp Number (Default 38244795)
  const rawNumber = storeSettings.whatsappNumber || '38244795';
  const cleanDigits = rawNumber.replace(/[^0-9]/g, '');
  const whatsAppPhone = cleanDigits.startsWith('973') 
    ? cleanDigits 
    : (cleanDigits.length === 8 ? `973${cleanDigits}` : cleanDigits || '97338244795');

  // Announcement and tagline directly from store settings
  const activeAnnouncement = storeSettings.announcementText || 'أرقى خامات الأقمشة الرجالية المختارة بعناية فائقة • متوفرة بالقطعة وطاقة القماش';
  const activeTagline = storeSettings.storeTagline || 'أقمشة رجالية فاخرة ومختارة بعناية';

  // Scroll to top button visibility state
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when fabric details modal is open & listen for Escape
  useEffect(() => {
    if (selectedFabric) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setSelectedFabric(null);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [selectedFabric]);

  const [isRefreshingStore, setIsRefreshingStore] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  // Load catalog & store settings (reusable for initial mount and manual refresh)
  const fetchCatalogAndSettings = async (isManual = false) => {
    if (isManual) setIsRefreshingStore(true);
    try {
      if (isManual) {
        // Clear caches and trigger SW update on manual refresh
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n))).catch(() => {});
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.update().catch(() => {});
          }
        }
      }

      // Single hardened source: /api/store (sanitized public projection served by the backend)
      const { settings: finalSettings, catalog: items } = await fetchPublicStore();
      setStoreSettings(finalSettings);

      if (finalSettings.defaultSeason && ['all', 'winter', 'summer', 'spring'].includes(finalSettings.defaultSeason)) {
        setSelectedSeason(finalSettings.defaultSeason as SeasonFilter);
      }

      const mapped: PublicFabric[] = items.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: 0, // exact stock levels are never exposed publicly
        isAvailable: item.isAvailable,
        isLowStock: item.isLowStock,
        isOutOfStock: item.isOutOfStock,
        category: item.category,
        imageUrl: item.imageUrl,
        season: item.season || '',
        description: item.description || ''
      }));
      setCatalog(mapped);
      // If currently selected season has 0 fabrics, automatically switch to 'all' so fabrics appear immediately
      setSelectedSeason((currentSeason) => {
        if (currentSeason === 'all') return 'all';
        const match = mapped.some(f => getFabricSeason(f) === currentSeason);
        return match ? currentSeason : 'all';
      });
    } catch (err) {
      console.error('Failed to load store data:', err);
    } finally {
      setLoading(false);
      setIsRefreshingStore(false);
    }
  };

  const handleRefreshStore = async () => {
    await fetchCatalogAndSettings(true);
    setRefreshSuccess(true);
    setTimeout(() => setRefreshSuccess(false), 3000);
  };

  useEffect(() => {
    fetchCatalogAndSettings();
  }, []);

  // Determine which season a fabric belongs to
  const getFabricSeason = (fabric: PublicFabric): SeasonKey => {
    const rawSeason = (fabric.season || '').trim().toLowerCase();
    if (rawSeason.includes('شتو') || rawSeason === 'winter') return 'winter';
    if (rawSeason.includes('صيف') || rawSeason === 'summer') return 'summer';
    if (rawSeason.includes('ربيع') || rawSeason === 'spring') return 'spring';

    const text = `${fabric.name || ''} ${fabric.category || ''}`.toLowerCase();
    if (/شتو|صوف|شكسبير|كشمير|جوخ|ثقيل|دافئ/i.test(text)) return 'winter';
    if (/صيف|بارد|قطن|تويوبو|سلك|ياباني|كتان|خفيف/i.test(text)) return 'summer';
    if (/ربيع|مخلوط|كريب|معتدل|وسط|ناعم/i.test(text)) return 'spring';

    // Default fallback to first season in the store's configured order
    return (storeSettings.seasonsOrder && storeSettings.seasonsOrder[0]) || 'winter';
  };

  // Group fabrics by season
  const groupedFabrics = useMemo(() => {
    const groups: Record<SeasonKey, PublicFabric[]> = {
      winter: [],
      summer: [],
      spring: [],
    };

    catalog.forEach(fabric => {
      // Hide out of stock if enabled in store settings
      if (storeSettings.hideOutOfStock && fabric.isOutOfStock) {
        return;
      }

      // Filter by search query if present
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches = fabric.name.toLowerCase().includes(query) ||
          fabric.category.toLowerCase().includes(query);
        if (!matches) return;
      }

      const season = getFabricSeason(fabric);
      if (groups[season]) {
        groups[season].push(fabric);
      } else {
        groups.winter.push(fabric);
      }
    });

    return groups;
  }, [catalog, searchQuery, storeSettings.hideOutOfStock]);

  // Active meters calculation in modal
  const activeMeters = useMemo(() => {
    if (tailorChoice === 'custom') return customMeters > 0 ? customMeters : 3.5;
    const opt = FABRIC_LENGTH_OPTIONS.find(o => o.id === tailorChoice);
    return opt ? opt.meters : (storeSettings.defaultThobeMeters || 3.5);
  }, [tailorChoice, customMeters, storeSettings.defaultThobeMeters]);

  // Estimated fabric price in modal (including delivery fee)
  const estimatedTotal = useMemo(() => {
    if (!selectedFabric) return '0.00';
    const fabricTotal = selectedFabric.price * activeMeters;
    return (fabricTotal + deliveryFee).toFixed(2);
  }, [selectedFabric, activeMeters, deliveryFee]);

  // Direct WhatsApp Link
  const getWhatsAppLink = (fabric?: PublicFabric, meters?: number, note?: string) => {
    const defaultMeters = meters !== undefined ? meters : activeMeters;
    const formattedMetersStr = formatMeters(defaultMeters);
    const defaultNote = note || (tailorChoice === 'custom' ? `مخصص (${formattedMetersStr} متر)` : FABRIC_LENGTH_OPTIONS.find(o => o.id === tailorChoice)?.label || 'قصة قياسية معتادة');
    let deliveryNote = 'قدوم شخصي (استلام من المحل)';
    if (deliveryType === 'توصيل') {
      const govInfo = BAHRAIN_GOVERNORATES[selectedGovernorate];
      const govName = govInfo ? govInfo.name : selectedGovernorate;
      const areaPart = selectedArea ? ` - منطقة ${selectedArea}` : '';
      deliveryNote = `توصيل (${govName}${areaPart} - رسوم ${deliveryFee.toFixed(2)} د.ب)`;
      if (addressDetails.trim()) {
        deliveryNote += `\n• تفاصيل العنوان: ${addressDetails.trim()}`;
      }
    }
    
    let msg = `السلام عليكم ورحمة الله، متجر نَسْجَة للأقمشة الرجالية\n`;
    if (fabric) {
      msg += `أود الاستفسار والطلب للقماش التالي:\n`;
      msg += `• اسم القماش: ${fabric.name}\n`;
      if (fabric.description) {
        msg += `• مواصفات ومعلومات إضافية: ${fabric.description}\n`;
      }
      msg += `• سعر المتر: ${fabric.price.toFixed(2)} د.ب\n`;
      msg += `• الطول المطلوب: ${formattedMetersStr} متر (${defaultNote})\n`;
      msg += `• آلية الاستلام: ${deliveryNote}\n`;
      if (deliveryType === 'توصيل' && deliveryFee > 0) {
        msg += `• رسوم التوصيل: ${deliveryFee.toFixed(2)} د.ب\n`;
      }
      msg += `• الإجمالي التقديري: ${(fabric.price * defaultMeters + deliveryFee).toFixed(2)} د.ب\n`;
    } else {
      msg += `أود الاستفسار والطلب لأفخر الأقمشة الرجالية المتاحة لديكم.\n`;
    }

    return `https://wa.me/${whatsAppPhone}?text=${encodeURIComponent(msg)}`;
  };

  // Determine the sequence of seasons to render
  const effectiveSeasonsOrder: SeasonKey[] = useMemo(() => {
    const configured = storeSettings.seasonsOrder && storeSettings.seasonsOrder.length > 0
      ? storeSettings.seasonsOrder
      : (['winter', 'summer', 'spring'] as SeasonKey[]);

    if (selectedSeason !== 'all') {
      return [selectedSeason];
    }
    return configured;
  }, [storeSettings.seasonsOrder, selectedSeason]);

  const totalVisibleFabrics = useMemo(() => {
    return effectiveSeasonsOrder.reduce((acc, seasonKey) => {
      return acc + (groupedFabrics[seasonKey]?.length || 0);
    }, 0);
  }, [effectiveSeasonsOrder, groupedFabrics]);

  return (
    <div className="min-h-screen w-full bg-[#FAF7F0] text-[#1D3A30] font-sans antialiased selection:bg-[#C7B895]/30 selection:text-[#1D3A30] text-right flex flex-col overflow-x-hidden" dir="rtl">
      
      {/* Toast Notification when refreshed */}
      <AnimatePresence>
        {refreshSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-[#1D3A30] text-[#E8D5A8] border border-[#C7B895]/50 px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold pointer-events-none"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>تم تحديث بيانات المتجر والمخزون بنجاح</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. COMPACT LUXURY ANNOUNCEMENT BAR */}
      {storeSettings.headerVisible && activeAnnouncement && (
        <div className="bg-[#1D3A30] text-[#FAF7F0] text-[11px] sm:text-xs py-2 px-4 border-b border-[#C7B895]/25 text-center font-medium tracking-wide flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E8D5A8] animate-pulse inline-block flex-shrink-0" />
          <span>{activeAnnouncement}</span>
        </div>
      )}

      {/* 2. HEADER WITH BRAND & WHATSAPP CTA */}
      <header className="sticky top-0 z-40 bg-[#FAF7F0]/95 backdrop-blur-md border-b border-[#C7B895]/30 px-4 sm:px-6 py-3 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <NasjahLogo variant="emblem" size="md" className="shadow-2xs ring-1 ring-[#C7B895]/40 rounded-xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-[#1D3A30]">
                  {storeSettings.storeName || 'نَسْجَة'}
                </h1>
                <span className="text-[10px] font-bold text-[#1D3A30] bg-[#FAF7F0] px-2 py-0.5 rounded-md border border-[#C7B895]/40 hidden xs:inline-block">
                  أقمشة وتفصيل رجالي
                </span>
              </div>
              <p className="text-[11px] text-[#1D3A30]/65 hidden sm:block">
                {activeTagline}
              </p>
            </div>
          </div>

          {/* WhatsApp Contact, Refresh Button & 3-Dots Corner Menu */}
          <div className="flex items-center gap-2">
            
            {/* Quick Refresh Button */}
            <button
              type="button"
              onClick={() => handleRefreshStore()}
              disabled={isRefreshingStore}
              aria-label="تحديث بيانات الأقمشة"
              title="تحديث البيانات من الخادم"
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all border active:scale-95 cursor-pointer bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border-[#C7B895]/50 shadow-2xs ${
                isRefreshingStore ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              <RotateCw className={`w-4 h-4 text-[#1D3A30] ${isRefreshingStore ? 'animate-spin text-[#A99872]' : ''}`} />
            </button>

            {/* Direct WhatsApp Call to Action (38244795) */}
            <a
              href={getWhatsAppLink()}
              target="_blank"
              rel="noreferrer"
              className="btn-primary-atelier flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              title={`تحدث مع المتجر عبر واتساب: ${rawNumber}`}
            >
              <WhatsAppIcon className="w-4 h-4 text-[#E8D5A8]" />
              <span className="hidden sm:inline">واتساب:</span>
              <span className="font-mono font-bold text-[#FAF7F0]">{rawNumber}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse hidden sm:inline-block" />
            </a>

            {/* THREE-DOTS CORNER MENU BUTTON */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="قائمة الأقسام والتواصل"
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all border active:scale-95 cursor-pointer ${
                  menuOpen 
                    ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs' 
                    : 'bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border-[#C7B895]/50 shadow-2xs'
                }`}
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* THREE-DOTS POPUP DROPDOWN MENU */}
              <AnimatePresence>
                {menuOpen && (
                  <>
                    {/* Backdrop to close menu */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setMenuOpen(false)} 
                    />

                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-2 w-72 rounded-2xl bg-white border border-[#C7B895]/40 shadow-xl p-2.5 z-50 text-right"
                    >
                      {/* Menu Header */}
                      <div className="px-3 py-2 border-b border-[#C7B895]/20 flex items-center justify-between">
                        <span className="text-xs font-black text-[#1D3A30]">أقسام الأقمشة</span>
                        <span className="text-[10px] text-[#A99872] font-bold">نَسْجَة</span>
                      </div>

                      {/* COLLAPSIBLE STRUCTURE: "جميع الأقمشة" at top with collapse/expand arrow on the left */}
                      <div className="py-1">
                        
                        {/* 1. Main Row: "جميع الأقمشة" with collapse arrow on left */}
                        <div
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition text-right cursor-pointer ${
                            selectedSeason === 'all'
                              ? 'bg-[#1D3A30] text-[#E8D5A8]'
                              : 'text-[#1D3A30] hover:bg-[#FAF7F0]'
                          }`}
                        >
                          <div 
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => {
                              setSelectedSeason('all');
                              setMenuOpen(false);
                            }}
                          >
                            <Sparkles className="w-4 h-4 text-[#C7B895]" />
                            <span className="font-black text-xs">جميع الأقمشة</span>
                          </div>

                          {/* Collapse / Expand Arrow on the Left */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsAllFabricsExpanded(!isAllFabricsExpanded);
                            }}
                            className={`p-1 rounded-lg transition hover:bg-black/10 cursor-pointer ${
                              selectedSeason === 'all' ? 'text-[#E8D5A8]' : 'text-[#1D3A30]/60'
                            }`}
                            title={isAllFabricsExpanded ? 'إخفاء الفروع' : 'إظهار الفروع'}
                          >
                            {isAllFabricsExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* 2. Sub-branches branching under "جميع الأقمشة" (Winter, Summer, Spring) */}
                        <AnimatePresence>
                          {isAllFabricsExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden mr-3 pr-2.5 border-r-2 border-[#C7B895]/30 space-y-1 my-1"
                            >
                              {/* Winter Fabrics */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSeason('winter');
                                  setMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition text-right cursor-pointer ${
                                  selectedSeason === 'winter'
                                    ? 'bg-[#FAF7F0] text-[#1D3A30] font-black border border-[#C7B895]/50'
                                    : 'text-[#1D3A30]/80 hover:bg-[#FAF7F0] hover:text-[#1D3A30]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Snowflake className="w-3.5 h-3.5 text-sky-600" />
                                  <span>أقمشة شتوية</span>
                                </div>
                              </button>

                              {/* Summer Fabrics */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSeason('summer');
                                  setMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition text-right cursor-pointer ${
                                  selectedSeason === 'summer'
                                    ? 'bg-[#FAF7F0] text-[#1D3A30] font-black border border-[#C7B895]/50'
                                    : 'text-[#1D3A30]/80 hover:bg-[#FAF7F0] hover:text-[#1D3A30]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                                  <span>أقمشة صيفية</span>
                                </div>
                              </button>

                              {/* Spring Fabrics */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSeason('spring');
                                  setMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition text-right cursor-pointer ${
                                  selectedSeason === 'spring'
                                    ? 'bg-[#FAF7F0] text-[#1D3A30] font-black border border-[#C7B895]/50'
                                    : 'text-[#1D3A30]/80 hover:bg-[#FAF7F0] hover:text-[#1D3A30]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>أقمشة ربيعية</span>
                                </div>
                              </button>

                            </motion.div>
                          )}
                        </AnimatePresence>

                      </div>

                      {/* Direct WhatsApp & Instagram (ZERO admin or login links) */}
                      <div className="pt-2 mt-1 border-t border-[#C7B895]/20 space-y-1">
                        <a
                          href={`https://wa.me/${whatsAppPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition"
                        >
                          <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
                          <span>محادثة واتساب ({rawNumber})</span>
                        </a>

                        <a
                          href={`https://instagram.com/${storeSettings.instagramHandle || 'nasjah.bh'}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#1D3A30] hover:bg-[#FAF7F0] transition"
                        >
                          <Instagram className="w-4 h-4 text-[#C7B895]" />
                          <span>إنستغرام (@{storeSettings.instagramHandle || 'nasjah.bh'})</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            handleRefreshStore();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#1D3A30] hover:bg-[#FAF7F0] transition text-right cursor-pointer"
                        >
                          <RotateCw className={`w-4 h-4 text-[#A99872] ${isRefreshingStore ? 'animate-spin' : ''}`} />
                          <span>تحديث المتجر والبيانات</span>
                        </button>
                      </div>

                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>
      </header>

      {/* 2.5 LUXURY TRUST & VALUE PROPOSITION BANNER */}
      <div className="bg-[#FAF7F0] border-b border-[#C7B895]/25 py-2.5 px-4 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between sm:justify-center gap-3 sm:gap-8 text-[11px] sm:text-xs font-bold text-[#1D3A30]/80 overflow-x-auto no-scrollbar whitespace-nowrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A99872]" />
            <span>🇧🇭 مملكة البحرين</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Truck className="w-3.5 h-3.5 text-[#A99872]" />
            <span>توصيل لكافة المحافظات</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Scissors className="w-3.5 h-3.5 text-[#A99872]" />
            <span>تفصيل وخياطة بالطلب</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 hidden xs:flex">
            <Sparkles className="w-3.5 h-3.5 text-[#A99872]" />
            <span>أقمشة يابانية وكورية فاخرة</span>
          </div>
        </div>
      </div>

      {/* 3. MODERN SEARCH & CATEGORY FILTER DOCK */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-3 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Clean search bar */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو مواصفات الخامة..."
              className="w-full pl-9 pr-11 py-2.5 rounded-2xl bg-white border border-[#C7B895]/40 text-xs font-medium focus:ring-2 focus:ring-[#1D3A30] outline-none shadow-2xs text-[#1D3A30] placeholder:text-[#1D3A30]/40 transition"
            />
            <Search className="w-4 h-4 text-[#A99872] absolute right-3.5 top-3" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-[#1D3A30]/40 hover:text-[#1D3A30] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Floating Atelier Category Filter Dock */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setSelectedSeason('all')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              selectedSeason === 'all'
                ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs border border-[#C7B895]/40 ring-1 ring-[#1D3A30]'
                : 'bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border border-[#C7B895]/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C7B895]" />
            <span>جميع الأقمشة</span>
          </button>
          
          {(['winter', 'summer', 'spring'] as SeasonKey[]).map((sk) => {
            const meta = SEASON_META[sk];
            const Icon = meta.icon;
            const count = groupedFabrics[sk]?.length || 0;
            return (
              <button
                key={sk}
                type="button"
                onClick={() => setSelectedSeason(sk)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  selectedSeason === sk
                    ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs border border-[#C7B895]/40 ring-1 ring-[#1D3A30]'
                    : 'bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border border-[#C7B895]/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#C7B895]" />
                <span>{meta.title}</span>
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/10 font-mono">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. MAIN CONTENT: SEQUENTIAL SECTIONS (In order specified by admin) */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-3 pb-20 space-y-10">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#1D3A30] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#1D3A30]/60">جارِ تحميل الأقمشة الفاخرة...</p>
          </div>
        ) : totalVisibleFabrics === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-[#C7B895]/30 max-w-lg mx-auto space-y-4 shadow-xs my-8">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40 flex items-center justify-center mx-auto text-[#1D3A30]">
              <Layers className="w-6 h-6 text-[#A99872]" />
            </div>
            {catalog.length > 0 ? (
              <>
                <h3 className="text-sm sm:text-base font-black text-[#1D3A30]">
                  لا توجد أقمشة تطابق الفلتر الحالي
                </h3>
                <p className="text-xs text-[#1D3A30]/65 leading-relaxed">
                  {searchQuery 
                    ? `لم يتم العثور على نتائج لبحثك عن "${searchQuery}".` 
                    : `لا توجد أقمشة في هذا التصنيف، ولكن تتوفر أقمشة أخرى في الأقسام المتبقية (${catalog.length} قماش).`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSeason('all');
                      setSearchQuery('');
                    }}
                    className="px-5 py-2.5 bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#C7B895]" />
                    <span>عرض جميع الأقمشة ({catalog.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRefreshStore()}
                    disabled={isRefreshingStore}
                    className="px-4 py-2.5 bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border border-[#C7B895]/40 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRefreshingStore ? 'animate-spin text-[#A99872]' : ''}`} />
                    <span>تحديث البيانات</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm sm:text-base font-black text-[#1D3A30]">
                  لا توجد أقمشة معروضة حالياً
                </h3>
                <p className="text-xs text-[#1D3A30]/65 leading-relaxed">
                  يجري تحديث تشكيلة الأقمشة، يمكنك النقر على تحديث البيانات أدناه لجلب أحدث التحديثات من الخادم مباشرة.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleRefreshStore()}
                    disabled={isRefreshingStore}
                    className="px-5 py-2.5 bg-[#1D3A30] text-[#E8D5A8] rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2 hover:bg-[#25493D]"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRefreshingStore ? 'animate-spin text-[#E8D5A8]' : ''}`} />
                    <span>تحديث البيانات من الخادم</span>
                  </button>
                  <a
                    href={`https://wa.me/${whatsAppPhone}?text=${encodeURIComponent('السلام عليكم، أود الاستفسار عن تشكيلة الأقمشة الرجالية المتوفرة لديكم')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#1D3A30] border border-[#C7B895]/40 rounded-xl text-xs font-bold transition hover:bg-[#FAF7F0]"
                  >
                    <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
                    <span>الاستفسار عبر واتساب</span>
                  </a>
                </div>
              </>
            )}
          </div>
        ) : (
          /* SECTIONS DISPLAYED IN THE SEQUENCE CONFIGURED BY ADMIN */
          effectiveSeasonsOrder.map((seasonKey) => {
            const fabrics = groupedFabrics[seasonKey] || [];
            if (fabrics.length === 0) {
              return null; // Do not show empty section or placeholders
            }

            const meta = SEASON_META[seasonKey];
            const Icon = meta.icon;

            return (
              <section key={seasonKey} className="space-y-4">
                
                {/* Section Header */}
                <div className="flex items-center justify-between border-b border-[#C7B895]/30 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#FAF7F0] border border-[#C7B895]/40 flex items-center justify-center text-[#1D3A30] shadow-2xs">
                      <Icon className="w-4 h-4 text-[#A99872]" />
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-[#1D3A30] tracking-tight">
                      {meta.title}
                    </h2>
                    <span className="text-xs font-mono font-bold text-[#A99872] bg-white px-2 py-0.5 rounded-lg border border-[#C7B895]/30">
                      ({fabrics.length})
                    </span>
                  </div>
                </div>

                {/* Section Fabric Cards Grid: Exactly 2 fabrics per horizontal row (square format) */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                  {fabrics.map((fabric) => (
                    <div
                      key={fabric.id}
                      onClick={() => {
                        setSelectedFabric(fabric);
                        setTailorChoice('cut_classic');
                        setCustomMeters(3.5);
                      }}
                      className="bg-white rounded-3xl overflow-hidden border border-[#C7B895]/30 shadow-[0_4px_16px_rgba(29,58,48,0.04)] hover:shadow-[0_12px_32px_rgba(29,58,48,0.1)] hover:border-[#1D3A30] transition-all duration-300 flex flex-col group cursor-pointer active:scale-[0.99]"
                      title="اضغط لعرض تفاصيل القماش كاملة وحاسبة الأمتار"
                    >
                      {/* Fabric Photo (Square Aspect Ratio) */}
                      <div className="relative aspect-square bg-[#FAF7F0] overflow-hidden">
                        {fabric.imageUrl ? (
                          <img
                            src={fabric.imageUrl}
                            alt={fabric.name}
                            className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500 ease-out"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-[#1D3A30]/40 p-3">
                            <Layers className="w-8 h-8 text-[#C7B895] mb-1.5 opacity-60" />
                            <span className="text-[10px] sm:text-[11px] font-bold text-[#1D3A30]/60">نَسْجَة</span>
                          </div>
                        )}

                        {/* Subtle gradient vignette at bottom of image for contrast */}
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                        {/* Stock Status Badge */}
                        <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 flex flex-col gap-1 items-start">
                          {fabric.isOutOfStock ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-rose-950/95 text-white backdrop-blur-xs shadow-xs border border-rose-800/40">
                              غير متوفر حالياً
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Content & Direct Tap Info */}
                      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5">
                        <div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                            <h3 className="text-xs sm:text-sm font-black text-[#1D3A30] line-clamp-1 group-hover:text-[#A99872] transition-colors">
                              {fabric.name}
                            </h3>
                            <div className="flex items-baseline gap-1 flex-shrink-0 bg-[#FAF7F0] px-2 py-0.5 rounded-lg border border-[#C7B895]/30 shadow-2xs">
                              <span className="text-sm sm:text-base font-black font-mono text-[#1D3A30]">
                                {fabric.price.toFixed(2)}
                              </span>
                              <span className="text-[9px] sm:text-[10px] font-bold text-[#A99872]">د.ب / م</span>
                            </div>
                          </div>

                          {fabric.description ? (
                            <p className="text-[10px] sm:text-[11px] text-[#1D3A30]/70 line-clamp-1">
                              {fabric.description}
                            </p>
                          ) : fabric.category ? (
                            <p className="text-[10px] sm:text-[11px] text-[#1D3A30]/60 line-clamp-1">
                              {fabric.category}
                            </p>
                          ) : null}
                        </div>

                        {/* Direct prompt to open fabric details */}
                        <div className="pt-2 flex items-center justify-between text-[10px] sm:text-[11px] text-[#A99872] group-hover:text-[#1D3A30] transition-colors border-t border-[#C7B895]/20 font-bold">
                          <span>عرض وتحديد الأمتار</span>
                          <span className="text-xs transition-transform group-hover:-translate-x-1 duration-200">←</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </section>
            );
          })
        )}
      </main>

      {/* 5. FABRIC DETAILS & LENGTH CALCULATION MODAL */}
      <AnimatePresence>
        {selectedFabric && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedFabric(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-[#C7B895]/40 shadow-2xl p-4 sm:p-6 text-right relative my-auto no-scrollbar"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedFabric(null)}
                className="absolute left-3 top-3 sm:left-4 sm:top-4 p-2 text-[#1D3A30]/60 hover:text-[#1D3A30] bg-[#FAF7F0] hover:bg-[#F2ECE0] rounded-xl transition cursor-pointer z-10 border border-[#C7B895]/30"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Full Product Photo */}
              <div className="relative aspect-16/10 sm:aspect-16/9 w-full rounded-2xl bg-[#FAF7F0] overflow-hidden border border-[#C7B895]/30 mb-4">
                {selectedFabric.imageUrl ? (
                  <img
                    src={selectedFabric.imageUrl}
                    alt={selectedFabric.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#1D3A30]/40 p-4">
                    <Layers className="w-10 h-10 text-[#C7B895] mb-2 opacity-60" />
                    <span className="text-xs font-bold text-[#1D3A30]/60">متجر وخياطة نَسْجَة</span>
                  </div>
                )}

                {/* Stock Status Badge inside Modal */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  {selectedFabric.isOutOfStock ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-900 text-white shadow-md">
                      غير متوفر حالياً
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Header Title & Price */}
              <div className="pb-3 border-b border-[#C7B895]/20 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base sm:text-lg font-black text-[#1D3A30]">
                    {selectedFabric.name}
                  </h3>
                  <div className="flex items-baseline gap-1 bg-[#FAF7F0] px-3 py-1 rounded-xl border border-[#C7B895]/30">
                    <span className="text-base sm:text-lg font-black font-mono text-[#1D3A30]">
                      {selectedFabric.price.toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-[#A99872]">د.ب / متر</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {selectedFabric.season && (
                    <span className="px-2 py-0.5 rounded-lg bg-[#FAF7F0] text-[#1D3A30] font-bold border border-[#C7B895]/30 text-[11px]">
                      موسم: {selectedFabric.season}
                    </span>
                  )}
                  {selectedFabric.category && (
                    <span className="px-2 py-0.5 rounded-lg bg-[#FAF7F0] text-[#1D3A30]/70 font-semibold border border-[#C7B895]/20 text-[11px]">
                      {selectedFabric.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Additional Product Specs / Description if available */}
              {selectedFabric.description && (
                <div className="mt-3.5 p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40 text-right space-y-1 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1D3A30]">
                    <Layers className="w-3.5 h-3.5 text-[#A99872]" />
                    <span>معلومات ومواصفات إضافية للمنتج:</span>
                  </div>
                  <p className="text-xs text-[#1D3A30]/85 leading-relaxed whitespace-pre-line font-medium">
                    {selectedFabric.description}
                  </p>
                </div>
              )}

              {/* Fabric Length Options Selector (Custom at top, followed by ascending meters) */}
              <div className="space-y-3 my-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-[#1D3A30]">
                    اختر طول القماش المطلوب أو حدد عدد الأمتار:
                  </label>
                  <span className="text-[10px] text-[#A99872] font-bold">الحساب بالمتر ونصف المتر</span>
                </div>

                <div className="space-y-2">
                  {FABRIC_LENGTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTailorChoice(opt.id)}
                      className={`w-full p-2.5 sm:p-3 rounded-2xl text-right border transition-all flex items-center justify-between cursor-pointer ${
                        tailorChoice === opt.id
                          ? 'bg-[#FAF7F0] border-[#1D3A30] ring-1 ring-[#1D3A30] shadow-xs'
                          : 'bg-white border-neutral-200 hover:border-[#C7B895]/50'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-[#1D3A30]">{opt.label}</p>
                        <p className="text-[11px] text-[#1D3A30]/60 mt-0.5">{opt.note}</p>
                      </div>
                      <div className="text-left flex-shrink-0 pl-2">
                        {opt.id !== 'custom' ? (
                          <span className="text-xs font-mono font-bold text-[#1D3A30] bg-white px-2 py-0.5 rounded-lg border border-[#C7B895]/30">
                            {formatMeters(opt.meters)} م
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[#A99872] bg-white px-2 py-0.5 rounded-lg border border-[#C7B895]/30">
                            مخصص
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Meters Counter & Stepper (Strictly whole & half meters: 0.5, 1.0, 1.5...) */}
                {tailorChoice === 'custom' && (
                  <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1D3A30]">عدد الأمتار المطلوبة (بالمتر ونصف المتر):</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCustomMeters(prev => Math.max(0.5, Math.round((prev - 0.5) * 2) / 2))}
                          className="w-7 h-7 rounded-lg bg-white border border-[#C7B895]/40 font-bold text-sm text-[#1D3A30] flex items-center justify-center hover:bg-[#F2ECE0] active:scale-95"
                          title="إنقاص نصف متر"
                        >
                          -
                        </button>
                        <span className="font-mono text-sm font-bold text-[#1D3A30] bg-white px-3 py-0.5 rounded-lg border border-[#C7B895]/40 min-w-[55px] text-center">
                          {formatMeters(customMeters)} م
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomMeters(prev => Math.min(50, Math.round((prev + 0.5) * 2) / 2))}
                          className="w-7 h-7 rounded-lg bg-white border border-[#C7B895]/40 font-bold text-sm text-[#1D3A30] flex items-center justify-center hover:bg-[#F2ECE0] active:scale-95"
                          title="زيادة نصف متر"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-[#1D3A30]/60">خيارات سريعة:</span>
                      {[
                        { label: '2.5 م', val: 2.5 },
                        { label: '3.0 م', val: 3.0 },
                        { label: '3.5 م', val: 3.5 },
                        { label: '4.0 م', val: 4.0 },
                        { label: '22.5 م (طاقة)', val: 22.5 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setCustomMeters(preset.val)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                            customMeters === preset.val
                              ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30]'
                              : 'bg-white text-[#1D3A30] border-[#C7B895]/30 hover:bg-[#FAF7F0]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="range"
                      min={0.5}
                      max={45.0}
                      step={0.5}
                      value={customMeters}
                      onChange={(e) => setCustomMeters(Math.round(parseFloat(e.target.value) * 2) / 2)}
                      className="w-full accent-[#1D3A30] cursor-pointer"
                    />
                  </div>
                )}

                {/* Receiving & Delivery Mechanism (آلية الاستلام والتوصيل) */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-[#C7B895]/40 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1D3A30] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#A99872]" />
                      <span>طريقة الاستلام المفضلة:</span>
                    </span>
                    <span className="text-[10px] text-[#A99872] font-bold">
                      {deliveryType === 'توصيل' 
                        ? (deliveryFee > 0 ? `+${deliveryFee} د.ب` : 'مجاني')
                        : 'استلام شخصي'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('قدوم شخصي')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 ${
                        deliveryType === 'قدوم شخصي'
                          ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs'
                          : 'bg-[#FAF7F0] text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]/80'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>قدوم شخصي</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryType('توصيل')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 ${
                        deliveryType === 'توصيل'
                          ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs'
                          : 'bg-[#FAF7F0] text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]/80'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>خدمة التوصيل</span>
                    </button>
                  </div>

                  {deliveryType === 'توصيل' && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-2 border-t border-[#C7B895]/30 space-y-3"
                    >
                      <div>
                        <span className="text-[11px] font-bold text-[#1D3A30] block mb-1.5">
                          اختر المحافظة:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {(Object.keys(BAHRAIN_GOVERNORATES) as BahrainGovernorateName[]).map((govName) => {
                            const gov = BAHRAIN_GOVERNORATES[govName];
                            const isSelected = selectedGovernorate === govName;
                            return (
                              <button
                                key={govName}
                                type="button"
                                onClick={() => {
                                  setSelectedGovernorate(govName);
                                  if (gov.areas.length > 0) {
                                    setSelectedArea(gov.areas[0]);
                                  }
                                }}
                                className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-0.5 active:scale-98 ${
                                  isSelected
                                    ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs'
                                    : 'bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]'
                                }`}
                              >
                                <span className="text-[11px] font-black">{gov.shortName}</span>
                                <span className="text-[9px] font-bold opacity-90">
                                  {gov.fee === 0.5 ? '500 فلس' : gov.fee === 1 ? '1.00 د.ب' : '2.00 د.ب'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Cascading Areas Dropdown */}
                      <div>
                        <span className="text-[11px] font-bold text-[#1D3A30] block mb-1">
                          اختر منطقة التوصيل ({BAHRAIN_GOVERNORATES[selectedGovernorate]?.name}):
                        </span>
                        <select
                          value={selectedArea}
                          onChange={(e) => setSelectedArea(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs bg-white text-[#1D3A30] font-bold"
                        >
                          {BAHRAIN_GOVERNORATES[selectedGovernorate]?.areas.map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Additional Address Details */}
                      <div>
                        <span className="text-[10px] text-[#1D3A30]/70 font-medium block mb-1">
                          تفاصيل العنوان (المجمع / الشارع / المنزل - اختياري):
                        </span>
                        <input
                          type="text"
                          placeholder="مثال: مجمع 1234، طريق 56، منزل 78"
                          value={addressDetails}
                          onChange={(e) => setAddressDetails(e.target.value)}
                          className="w-full p-2 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs bg-white text-[#1D3A30]"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Price Calculation Summary */}
              <div className="p-4 rounded-2xl bg-[#1D3A30] text-[#FAF7F0] space-y-2 shadow-sm border border-[#C7B895]/30">
                <div className="flex items-center justify-between text-xs text-[#FAF7F0]/80">
                  <span>سعر المتر × {formatMeters(activeMeters)} متر:</span>
                  <span className="font-mono">{(selectedFabric.price * activeMeters).toFixed(2)} د.ب</span>
                </div>
                {deliveryType === 'توصيل' && deliveryFee > 0 && (
                  <div className="flex items-center justify-between text-xs text-[#E8D5A8]">
                    <span>رسوم التوصيل ({BAHRAIN_GOVERNORATES[selectedGovernorate]?.shortName} - {selectedArea}):</span>
                    <span className="font-mono">+{deliveryFee.toFixed(2)} د.ب</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-1 border-t border-[#C7B895]/20">
                  <span className="text-xs font-extrabold text-[#E8D5A8]">الإجمالي التقديري للطلب:</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white font-mono">{estimatedTotal}</span>
                    <span className="text-xs font-bold text-[#E8D5A8]">د.ب</span>
                  </div>
                </div>
              </div>

              {/* Final WhatsApp Order Button */}
              <div className="mt-4 space-y-2">
                <a
                  href={getWhatsAppLink(selectedFabric)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-md active:scale-98 cursor-pointer"
                >
                  <WhatsAppIcon className="w-4 h-4 text-white" />
                  <span>طلب القماش الآن وتأكيد الأمتار عبر واتساب ({rawNumber})</span>
                </a>

                <button
                  type="button"
                  onClick={() => setSelectedFabric(null)}
                  className="w-full py-2 text-center text-xs text-[#1D3A30]/60 hover:text-[#1D3A30] cursor-pointer"
                >
                  إغلاق ومتابعة التصفح
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5.5 FLOATING BACK-TO-TOP BUTTON */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-5 sm:bottom-8 sm:right-8 z-40 px-3.5 py-2.5 rounded-2xl bg-[#1D3A30] text-[#E8D5A8] border border-[#C7B895]/60 shadow-xl flex items-center gap-1.5 text-xs font-bold transition hover:bg-[#25493D] active:scale-95 cursor-pointer backdrop-blur-md"
            title="العودة لأعلى الصفحة"
          >
            <ArrowUp className="w-4 h-4 text-[#E8D5A8]" />
            <span className="text-[11px] font-black">للأعلى</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* 6. CLEAN FOOTER (ZERO admin or login links) */}
      <footer className="bg-[#1D3A30] text-[#FAF7F0] py-8 px-4 sm:px-6 border-t border-[#C7B895]/20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <NasjahLogo variant="emblem" size="sm" />
            <div>
              <p className="font-bold text-[#FAF7F0]">{storeSettings.storeName || 'نَسْجَة للأقمشة الرجالية'}</p>
              <p className="text-[10px] text-[#C7B895]">مملكة البحرين • واتساب: {rawNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-[#FAF7F0]/70">
            <a
              href={`https://wa.me/${whatsAppPhone}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#E8D5A8] transition flex items-center gap-1"
            >
              <WhatsAppIcon className="w-3.5 h-3.5" />
              <span>محادثة واتساب ({rawNumber})</span>
            </a>
            <span>•</span>
            <a
              href={`https://instagram.com/${storeSettings.instagramHandle || 'nasjah.bh'}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#E8D5A8] transition"
            >
              إنستغرام (@{storeSettings.instagramHandle || 'nasjah.bh'})
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
