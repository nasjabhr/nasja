import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  Scissors,
  Instagram, 
  MoreVertical,
  Layers,
  Sparkles,
  Truck,
  User,
  ArrowUp,
  CheckCircle2,
  RotateCw
} from 'lucide-react';
import NasjahLogo from '../components/NasjahLogo';
import SplashScreen from '../components/SplashScreen';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { StoreSettings, BahrainGovernorateName, BAHRAIN_GOVERNORATES } from '../types';
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

export interface StoreFabricOption {
  id: string;
  name: string;
  itemNumber: number;
  fullName: string;
  price: number;
  imageUrl?: string;
  description?: string;
  isOutOfStock: boolean;
  isAvailable: boolean;
  isLowStock: boolean;
}

export interface StoreProduct {
  id: string;
  baseName: string;
  isSet: boolean;
  defaultPrice: number;
  imageUrl?: string;
  description?: string;
  category?: string;
  options: StoreFabricOption[];
  isAllOutOfStock: boolean;
}

export function formatMeters(meters: number): string {
  const rounded = Math.round(Number(meters || 0) * 2) / 2;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

export default function Store() {
  const [catalog, setCatalog] = useState<PublicFabric[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => getLocalStoreSettings());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 3-dots Menu State
  const [menuOpen, setMenuOpen] = useState(false);

  // Selected Product & Selected Numbered Option
  const [activeProduct, setActiveProduct] = useState<StoreProduct | null>(null);
  const [selectedOption, setSelectedOption] = useState<StoreFabricOption | null>(null);

  // Horizontal meters slider: minimum 1.0 meter, default 3.5 meters
  const [customMeters, setCustomMeters] = useState<number>(3.5);

  // Receiving mechanism: 'قدوم شخصي' (استلام من المحل) or 'توصيل'
  const [deliveryType, setDeliveryType] = useState<'قدوم شخصي' | 'توصيل'>('قدوم شخصي');
  const [selectedGovernorate, setSelectedGovernorate] = useState<BahrainGovernorateName>('المحافظة الشمالية');
  const [selectedArea, setSelectedArea] = useState<string>('سار');
  const [addressDetails, setAddressDetails] = useState<string>('');

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
    if (activeProduct) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setActiveProduct(null);
          setSelectedOption(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [activeProduct]);

  const [isRefreshingStore, setIsRefreshingStore] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  // Load catalog & store settings
  const fetchCatalogAndSettings = async (isManual = false) => {
    if (isManual) setIsRefreshingStore(true);
    try {
      if (isManual) {
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

      const { settings: finalSettings, catalog: items } = await fetchPublicStore();
      setStoreSettings(finalSettings);

      const mapped: PublicFabric[] = items.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: 0,
        isAvailable: item.isAvailable,
        isLowStock: item.isLowStock,
        isOutOfStock: item.isOutOfStock,
        category: item.category,
        imageUrl: item.imageUrl,
        season: item.season || '',
        description: item.description || ''
      }));
      setCatalog(mapped);
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

  // Group fabrics into Sets and Single items (Seasons completely removed)
  const displayProducts: StoreProduct[] = useMemo(() => {
    const groupsMap = new Map<string, StoreProduct>();
    const singleProducts: StoreProduct[] = [];

    // Filter by search query if present
    const filteredCatalog = catalog.filter((fabric) => {
      if (storeSettings.hideOutOfStock && fabric.isOutOfStock) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          fabric.name.toLowerCase().includes(query) ||
          fabric.category.toLowerCase().includes(query) ||
          (fabric.description && fabric.description.toLowerCase().includes(query))
        );
      }
      return true;
    });

    // Detect numbered collections (e.g. "برج العرب - 1", "برج العرب - 2")
    filteredCatalog.forEach((fabric) => {
      const match = fabric.name.match(/^(.*?)\s*[-–—]\s*(\d+)$/);
      if (match) {
        const baseName = match[1].trim();
        const itemNumber = parseInt(match[2], 10);
        const opt: StoreFabricOption = {
          id: fabric.id,
          name: fabric.name,
          itemNumber,
          fullName: fabric.name,
          price: fabric.price,
          imageUrl: fabric.imageUrl,
          description: fabric.description,
          isOutOfStock: fabric.isOutOfStock,
          isAvailable: fabric.isAvailable,
          isLowStock: fabric.isLowStock,
        };

        if (!groupsMap.has(baseName)) {
          groupsMap.set(baseName, {
            id: `group_${baseName}`,
            baseName,
            isSet: true,
            defaultPrice: fabric.price,
            imageUrl: fabric.imageUrl,
            description: fabric.description,
            category: fabric.category,
            options: [opt],
            isAllOutOfStock: fabric.isOutOfStock,
          });
        } else {
          const group = groupsMap.get(baseName)!;
          group.options.push(opt);
          if (!fabric.isOutOfStock) {
            group.isAllOutOfStock = false;
          }
          if (!group.imageUrl && fabric.imageUrl) {
            group.imageUrl = fabric.imageUrl;
          }
        }
      } else {
        singleProducts.push({
          id: fabric.id,
          baseName: fabric.name,
          isSet: false,
          defaultPrice: fabric.price,
          imageUrl: fabric.imageUrl,
          description: fabric.description,
          category: fabric.category,
          options: [{
            id: fabric.id,
            name: fabric.name,
            itemNumber: 1,
            fullName: fabric.name,
            price: fabric.price,
            imageUrl: fabric.imageUrl,
            description: fabric.description,
            isOutOfStock: fabric.isOutOfStock,
            isAvailable: fabric.isAvailable,
            isLowStock: fabric.isLowStock,
          }],
          isAllOutOfStock: fabric.isOutOfStock,
        });
      }
    });

    // Sort options inside each group by itemNumber ascending (1, 2, 3...)
    const sets = Array.from(groupsMap.values()).map((g) => {
      g.options.sort((a, b) => a.itemNumber - b.itemNumber);
      return g;
    });

    return [...sets, ...singleProducts];
  }, [catalog, searchQuery, storeSettings.hideOutOfStock]);

  // Open modal for a product
  const handleOpenProductModal = (product: StoreProduct) => {
    setActiveProduct(product);
    // Select first in-stock option, or fallback to first option
    const firstAvailable = product.options.find((o) => !o.isOutOfStock) || product.options[0];
    setSelectedOption(firstAvailable || null);
    setCustomMeters(3.5);
    setDeliveryType('قدوم شخصي');
  };

  const handleCloseProductModal = () => {
    setActiveProduct(null);
    setSelectedOption(null);
  };

  // Pure fabric total (delivery fee removed completely as instructed)
  const currentPrice = selectedOption?.price || activeProduct?.defaultPrice || 0;
  const estimatedTotal = (currentPrice * customMeters).toFixed(2);

  // Exact WhatsApp Link format requested by user
  const getWhatsAppLink = (product?: StoreProduct, option?: StoreFabricOption, meters?: number) => {
    const targetProduct = product || activeProduct;
    const targetOption = option || selectedOption;

    if (!targetProduct || !targetOption) {
      const generalMsg = `السلام عليكم ورحمة الله وبركاته، متجر نَسْجَة للأقمشة الرجالية\nأود الاستفسار عن تشكيلة الأقمشة الرجالية المتاحة لديكم.`;
      return `https://wa.me/${whatsAppPhone}?text=${encodeURIComponent(generalMsg)}`;
    }

    const defaultMeters = meters !== undefined ? meters : customMeters;
    const formattedMetersStr = Number(defaultMeters).toString();
    const unitPriceStr = Number(targetOption.price).toFixed(2);
    const totalPriceStr = (targetOption.price * defaultMeters).toFixed(2);

    let deliveryMethodStr = 'استلام من المحل';
    if (deliveryType === 'توصيل') {
      const area = selectedArea || selectedGovernorate;
      const addr = addressDetails.trim() ? ` (${addressDetails.trim()})` : '';
      deliveryMethodStr = `توصيل - ${area}${addr}`;
    }

    const msg = `السلام عليكم ورحمة الله وبركاته، متجر نَسْجَة للأقمشة الرجالية
أود طلب القماش الاّتي:
• اسم القماش: ${targetOption.fullName}
• سعر المتر: ${unitPriceStr} د.ب
• عدد الأمتار: ${formattedMetersStr}
• طريقة الاستلام: ${deliveryMethodStr}
• السعر الإجمالي: ${totalPriceStr} د.ب`;

    return `https://wa.me/${whatsAppPhone}?text=${encodeURIComponent(msg)}`;
  };

  if (loading) {
    return (
      <SplashScreen
        statusText="جارِ تجهيز تشكيلة الأقمشة الفاخرة من قاعدة البيانات..."
        subTitle={storeSettings.storeTagline || 'أقمشة رجالية فاخرة ومختارة بعناية'}
        onRetry={() => fetchCatalogAndSettings(true)}
      />
    );
  }

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
          
          {/* Brand Identity with Logo */}
          <div className="flex items-center gap-3">
            <NasjahLogo variant="emblem" size="md" className="shadow-2xs ring-1 ring-[#C7B895]/40 rounded-xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-[#1D3A30]">
                  {storeSettings.storeName || 'نَسْجَة'}
                </h1>
                <span className="text-[10px] font-bold text-[#1D3A30] bg-[#FAF7F0] px-2 py-0.5 rounded-md border border-[#C7B895]/40 hidden xs:inline-block">
                  أقمشة رجالية فاخرة
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

            {/* Direct WhatsApp Call to Action */}
            <a
              href={getWhatsAppLink()}
              target="_blank"
              rel="noreferrer"
              className="btn-primary-atelier flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] border border-[#C7B895]/40"
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
                aria-label="قائمة الخيارات"
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
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setMenuOpen(false)} 
                    />

                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-2 w-64 rounded-2xl bg-white border border-[#C7B895]/40 shadow-xl p-2.5 z-50 text-right space-y-1.5"
                    >
                      <div className="px-3 py-2 border-b border-[#C7B895]/20 flex items-center justify-between">
                        <span className="text-xs font-black text-[#1D3A30]">خيارات المتجر</span>
                        <span className="text-[10px] text-[#A99872] font-bold">نَسْجَة</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          handleRefreshStore();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#1D3A30] hover:bg-[#FAF7F0] transition text-right cursor-pointer"
                      >
                        <RotateCw className="w-4 h-4 text-[#A99872]" />
                        <span>تحديث الأقمشة من الخادم</span>
                      </button>

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
                        <Instagram className="w-4 h-4 text-[#A99872]" />
                        <span>حساب إنستغرام</span>
                      </a>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </header>

      {/* 2.5 LUXURY VALUE PROPOSITION BANNER */}
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
            <span>أقمشة وتفصيل راقٍ</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 hidden xs:flex">
            <Sparkles className="w-3.5 h-3.5 text-[#A99872]" />
            <span>أرقى الخامات اليابانية والكورية</span>
          </div>
        </div>
      </div>

      {/* 3. CLEAN SEARCH BAR & COUNT BAR */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم القماش أو المجموعة..."
              className="w-full pl-9 pr-11 py-2.5 rounded-2xl bg-white border border-[#C7B895]/40 text-xs font-medium focus:ring-2 focus:ring-[#1D3A30] outline-none shadow-2xs text-[#1D3A30] placeholder:text-[#1D3A30]/40 transition"
            />
            <Search className="w-4 h-4 text-[#A99872] absolute right-3.5 top-3" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-[#1D3A30]/40 hover:text-[#1D3A30] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Catalog Count Indicator */}
          <div className="text-xs font-bold text-[#1D3A30]/75 flex items-center gap-1.5 self-end sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-[#1D3A30]" />
            <span>تشكيلة الأقمشة ({displayProducts.length})</span>
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT: UNIFIED FABRIC AND SETS GRID */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 pb-20">
        {displayProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-[#C7B895]/30 max-w-lg mx-auto space-y-4 shadow-xs my-8">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40 flex items-center justify-center mx-auto text-[#1D3A30]">
              <Layers className="w-6 h-6 text-[#A99872]" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-[#1D3A30]">
              {searchQuery ? `لم يتم العثور على أقمشة تطابق "${searchQuery}"` : 'لا توجد أقمشة متوفرة حالياً'}
            </h3>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-5 py-2 bg-[#1D3A30] text-[#E8D5A8] rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                عرض كافة الأقمشة
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5">
            {displayProducts.map((product) => {
              return (
                <div
                  key={product.id}
                  onClick={() => handleOpenProductModal(product)}
                  className="bg-white rounded-3xl overflow-hidden border border-[#C7B895]/30 shadow-[0_4px_16px_rgba(29,58,48,0.04)] hover:shadow-[0_12px_32px_rgba(29,58,48,0.1)] hover:border-[#1D3A30] transition-all duration-300 flex flex-col group cursor-pointer active:scale-[0.99]"
                  title="اضغط لعرض التفاصيل وتحديد الأمتار"
                >
                  {/* Photo (Square Aspect Ratio) */}
                  <div className="relative aspect-square bg-[#FAF7F0] overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.baseName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#1D3A30]/40 p-3">
                        <Layers className="w-8 h-8 text-[#C7B895] mb-1.5 opacity-60" />
                        <span className="text-[10px] sm:text-[11px] font-bold text-[#1D3A30]/60">نَسْجَة</span>
                      </div>
                    )}

                    {/* Subtle gradient vignette */}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Stock Status Badge */}
                    <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 flex flex-col gap-1 items-start">
                      {product.isAllOutOfStock ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-rose-950/95 text-white backdrop-blur-xs shadow-xs border border-rose-800/40">
                          غير متوفر حالياً
                        </span>
                      ) : product.isSet ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1D3A30]/90 text-[#E8D5A8] backdrop-blur-xs shadow-xs border border-[#C7B895]/40">
                          مجموعة ({product.options.length})
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                        <h3 className="text-xs sm:text-sm font-black text-[#1D3A30] line-clamp-1 group-hover:text-[#A99872] transition-colors">
                          {product.baseName}
                        </h3>
                        <div className="flex items-baseline gap-1 flex-shrink-0 bg-[#FAF7F0] px-2 py-0.5 rounded-lg border border-[#C7B895]/30 shadow-2xs">
                          <span className="text-sm sm:text-base font-black font-mono text-[#1D3A30]">
                            {product.defaultPrice.toFixed(2)}
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold text-[#A99872]">د.ب / م</span>
                        </div>
                      </div>

                      {product.description ? (
                        <p className="text-[10px] sm:text-[11px] text-[#1D3A30]/70 line-clamp-1">
                          {product.description}
                        </p>
                      ) : null}

                      {/* Numbered Set Items Preview (with Out of stock tags) */}
                      {product.isSet && product.options.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-2">
                          {product.options.map((opt) => (
                            <span
                              key={opt.id}
                              className={`px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold border ${
                                opt.isOutOfStock
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 line-through'
                                  : 'bg-[#FAF7F0] text-[#1D3A30] border-[#C7B895]/40'
                              }`}
                            >
                              {opt.itemNumber} {opt.isOutOfStock ? '(انتهت الكمية)' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Direct prompt */}
                    <div className="pt-2 flex items-center justify-between text-[10px] sm:text-[11px] text-[#A99872] group-hover:text-[#1D3A30] transition-colors border-t border-[#C7B895]/20 font-bold">
                      <span>عرض وتحديد الأمتار</span>
                      <span className="text-xs transition-transform group-hover:-translate-x-1 duration-200">←</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. FABRIC DETAILS & LENGTH CALCULATION MODAL */}
      <AnimatePresence>
        {activeProduct && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseProductModal();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-[#C7B895]/50 my-auto text-right space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar"
            >
              
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-[#C7B895]/30 pb-3">
                <button
                  type="button"
                  onClick={handleCloseProductModal}
                  aria-label="إغلاق النافذة"
                  className="p-1.5 rounded-full hover:bg-neutral-100 text-[#1D3A30]/60 hover:text-[#1D3A30] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#1D3A30]">
                    {selectedOption?.fullName || activeProduct.baseName}
                  </h2>
                  <p className="text-[11px] text-[#A99872] font-semibold">
                    متجر نَسْجَة للأقمشة الرجالية
                  </p>
                </div>
              </div>

              {/* Photo Preview & Pricing Header */}
              <div className="flex gap-3 items-center p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-[#C7B895]/30 flex-shrink-0 shadow-2xs">
                  {(selectedOption?.imageUrl || activeProduct.imageUrl) ? (
                    <img 
                      src={selectedOption?.imageUrl || activeProduct.imageUrl} 
                      alt={selectedOption?.fullName || activeProduct.baseName}
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#1D3A30]/40">
                      <Layers className="w-6 h-6 text-[#A99872]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-[#1D3A30] truncate">
                    {selectedOption?.fullName || activeProduct.baseName}
                  </h3>
                  <div className="flex items-baseline gap-1 mt-1 font-mono">
                    <span className="text-base sm:text-lg font-black text-[#1D3A30]">
                      {(selectedOption?.price || activeProduct.defaultPrice).toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-[#A99872]">د.ب للمتر</span>
                  </div>
                </div>
              </div>

              {/* Description if available */}
              {(selectedOption?.description || activeProduct.description) && (
                <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#C7B895]/30 text-xs text-[#1D3A30]/85 leading-relaxed font-medium">
                  {selectedOption?.description || activeProduct.description}
                </div>
              )}

              {/* NUMBERED SET SELECTOR (When product has multiple items) */}
              {activeProduct.isSet && activeProduct.options.length > 1 && (
                <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#1D3A30]">
                      اختر رقم القماش من المجموعة:
                    </label>
                    <span className="text-[10px] text-[#A99872] font-bold">
                      المحدد: {selectedOption?.fullName}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {activeProduct.options.map((opt) => {
                      const isSelected = selectedOption?.id === opt.id;
                      const isOut = opt.isOutOfStock;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isOut}
                          onClick={() => {
                            if (!isOut) setSelectedOption(opt);
                          }}
                          className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-98 ${
                            isOut
                              ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-80'
                              : isSelected
                              ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs'
                              : 'bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#F2ECE0]'
                          }`}
                        >
                          <span className="text-xs font-black">رقم {opt.itemNumber}</span>
                          {isOut ? (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.2 rounded">
                              انتهت الكمية
                            </span>
                          ) : (
                            <span className={`text-[10px] font-mono ${isSelected ? 'text-[#E8D5A8]' : 'text-emerald-700 font-bold'}`}>
                              {opt.price.toFixed(2)} د.ب
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* HORIZONTAL METERS SLIDER (Minimum 1 meter, Default 3.5 meters) */}
              <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black text-[#1D3A30]">
                      حدد عدد الأمتار المطلوبة:
                    </label>
                    <span className="text-[10px] text-[#A99872] font-semibold">
                      حرك المؤشر الأفقي (أقل حد يمكن طلبه 1 متر)
                    </span>
                  </div>
                  
                  {/* Selected Meters Display with +/- Steppers */}
                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#C7B895]/40 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setCustomMeters((prev) => Math.max(1.0, Math.round((prev - 0.5) * 2) / 2))}
                      className="w-7 h-7 rounded-lg bg-[#FAF7F0] border border-[#C7B895]/30 font-bold text-sm text-[#1D3A30] flex items-center justify-center hover:bg-[#F2ECE0] active:scale-95 cursor-pointer"
                      title="إنقاص نصف متر"
                    >
                      -
                    </button>
                    <span className="font-mono text-sm font-black text-[#1D3A30] px-2 min-w-[55px] text-center">
                      {customMeters} م
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomMeters((prev) => Math.min(30.0, Math.round((prev + 0.5) * 2) / 2))}
                      className="w-7 h-7 rounded-lg bg-[#FAF7F0] border border-[#C7B895]/30 font-bold text-sm text-[#1D3A30] flex items-center justify-center hover:bg-[#F2ECE0] active:scale-95 cursor-pointer"
                      title="زيادة نصف متر"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* The Horizontal Range Slider */}
                <div className="space-y-1.5 pt-1">
                  <input
                    type="range"
                    min={1.0}
                    max={25.0}
                    step={0.5}
                    value={customMeters}
                    onChange={(e) => setCustomMeters(parseFloat(e.target.value))}
                    className="w-full accent-[#1D3A30] cursor-pointer h-2 bg-[#E8D5A8]/50 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-[#1D3A30]/65 font-mono font-bold px-1">
                    <span>1 متر</span>
                    <span className="text-[#1D3A30] font-black">3.5 م (ثوب كامل)</span>
                    <span>10 م</span>
                    <span>22.5 م (طاقة)</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#C7B895]/20">
                  <span className="text-[10px] text-[#1D3A30]/60 font-bold">خيارات سريعة:</span>
                  {[
                    { label: '1 م', val: 1.0 },
                    { label: '2.5 م', val: 2.5 },
                    { label: '3.5 م (موصى به)', val: 3.5 },
                    { label: '4.0 م (وافي)', val: 4.0 },
                    { label: '22.5 م (طاقة)', val: 22.5 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setCustomMeters(preset.val)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                        customMeters === preset.val
                          ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30]'
                          : 'bg-white text-[#1D3A30] border-[#C7B895]/30 hover:bg-[#FAF7F0]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* RECEIVING MECHANISM (Zero delivery fee calculation) */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-[#C7B895]/40 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1D3A30] flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#A99872]" />
                    <span>طريقة الاستلام:</span>
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
                    <span>استلام من المحل</span>
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
                              className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center active:scale-98 ${
                                isSelected
                                  ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs'
                                  : 'bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]'
                              }`}
                            >
                              <span className="text-[11px] font-black">{gov.shortName}</span>
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

              {/* Price Calculation Summary (Zero Delivery Fee added) */}
              <div className="p-4 rounded-2xl bg-[#1D3A30] text-[#FAF7F0] space-y-2 shadow-sm border border-[#C7B895]/30">
                <div className="flex items-center justify-between text-xs text-[#FAF7F0]/80">
                  <span>سعر المتر × {customMeters} متر:</span>
                  <span className="font-mono">{(currentPrice * customMeters).toFixed(2)} د.ب</span>
                </div>
                <div className="flex items-baseline justify-between pt-1 border-t border-[#C7B895]/20">
                  <span className="text-xs font-extrabold text-[#E8D5A8]">السعر الإجمالي:</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white font-mono">{estimatedTotal}</span>
                    <span className="text-xs font-bold text-[#E8D5A8]">د.ب</span>
                  </div>
                </div>
              </div>

              {/* Final WhatsApp Order Button */}
              <div className="mt-4 space-y-2">
                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-md active:scale-98 cursor-pointer"
                >
                  <WhatsAppIcon className="w-4 h-4 text-white" />
                  <span>طلب القماش الآن عبر واتساب ({rawNumber})</span>
                </a>

                <button
                  type="button"
                  onClick={handleCloseProductModal}
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

      {/* 6. CLEAN FOOTER */}
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
