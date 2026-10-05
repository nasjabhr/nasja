import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  Instagram, 
  MoreVertical, 
  Layers, 
  Sparkles, 
  Truck, 
  User, 
  MapPin, 
  ArrowUp, 
  CheckCircle2, 
  RotateCw,
  Sun,
  Snowflake,
  Leaf,
  ChevronLeft,
  ChevronRight,
  ZoomIn
} from 'lucide-react';
import NasjahLogo from '../components/NasjahLogo';
import SplashScreen from '../components/SplashScreen';
import WhatsAppIcon from '../components/WhatsAppIcon';
import LocationPickerMap, { LocationCoordinates } from '../components/LocationPickerMap';
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
  season?: string;
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
  const [selectedSeason, setSelectedSeason] = useState<string>(() => getLocalStoreSettings().defaultSeason || 'all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 3-dots Menu State
  const [menuOpen, setMenuOpen] = useState(false);

  // Selected Product & Selected Numbered Option
  const [activeProduct, setActiveProduct] = useState<StoreProduct | null>(null);
  const [selectedOption, setSelectedOption] = useState<StoreFabricOption | null>(null);

  // Horizontal meters slider: minimum 1.0 meter, default 3.5 meters
  const [customMeters, setCustomMeters] = useState<number>(3.5);

  // Receiving mechanism: 'قدوم شخصي' (استلام من المقر) or 'توصيل' (خدمة التوصيل بالبحرين)
  const [deliveryType, setDeliveryType] = useState<'قدوم شخصي' | 'توصيل'>('قدوم شخصي');
  const [customerLocation, setCustomerLocation] = useState<LocationCoordinates | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');

  // Image Gallery Lightbox state & touch swipe tracking
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

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

  // Season tabs configuration and counts
  const seasonTabs = useMemo(() => {
    const order = (storeSettings.seasonsOrder && storeSettings.seasonsOrder.length > 0)
      ? storeSettings.seasonsOrder
      : (['spring', 'winter', 'summer'] as ('spring' | 'winter' | 'summer')[]);

    const seasonConfig: Record<string, { label: string; icon: any; emoji: string }> = {
      spring: { label: 'أقمشة ربيعية', icon: Leaf, emoji: '🌿' },
      winter: { label: 'أقمشة شتوية', icon: Snowflake, emoji: '❄️' },
      summer: { label: 'أقمشة صيفية', icon: Sun, emoji: '☀️' },
    };

    const countFor = (key: string) => {
      if (key === 'all') return catalog.length;
      return catalog.filter((f) => {
        const s = (f.season || 'ربيعي').toLowerCase().trim();
        const isAll = s === 'كافة الفصول' || s === 'all' || s === 'كافة';
        if (key === 'winter') return isAll || s.includes('شتو') || s === 'winter';
        if (key === 'summer') return isAll || s.includes('صيف') || s === 'summer';
        if (key === 'spring') return isAll || s.includes('ربيع') || s === 'spring';
        return false;
      }).length;
    };

    return [
      { id: 'all', label: 'جميع الأقمشة', icon: Layers, emoji: '✨', count: countFor('all') },
      ...order.map((key) => ({
        id: key,
        label: seasonConfig[key]?.label || key,
        icon: seasonConfig[key]?.icon || Sparkles,
        emoji: seasonConfig[key]?.emoji || '',
        count: countFor(key),
      })),
    ];
  }, [storeSettings.seasonsOrder, catalog]);

  // Group fabrics into Sets and Single items with Season categorization
  const displayProducts: StoreProduct[] = useMemo(() => {
    const groupsMap = new Map<string, StoreProduct>();
    const singleProducts: StoreProduct[] = [];

    // Filter by season and search query if present
    const filteredCatalog = catalog.filter((fabric) => {
      if (storeSettings.hideOutOfStock && fabric.isOutOfStock) {
        return false;
      }

      // Season filter
      if (selectedSeason !== 'all') {
        const s = (fabric.season || 'ربيعي').toLowerCase().trim();
        const isAll = s === 'كافة الفصول' || s === 'all' || s === 'كافة';
        const matches =
          (selectedSeason === 'winter' && (s.includes('شتو') || s === 'winter')) ||
          (selectedSeason === 'summer' && (s.includes('صيف') || s === 'summer')) ||
          (selectedSeason === 'spring' && (s.includes('ربيع') || s === 'spring'));

        if (!matches && !isAll) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          fabric.name.toLowerCase().includes(query) ||
          fabric.category.toLowerCase().includes(query) ||
          (fabric.season && fabric.season.toLowerCase().includes(query)) ||
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
            season: fabric.season,
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
          if (!group.season && fabric.season) {
            group.season = fabric.season;
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
          season: fabric.season,
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

    const allProducts = [...sets, ...singleProducts];

    // Priority sort according to storeSettings.seasonsOrder
    const order = storeSettings.seasonsOrder || ['spring', 'winter', 'summer'];
    const getSeasonWeight = (s?: string) => {
      if (!s) return 90;
      const lower = s.toLowerCase();
      let key = 'spring';
      if (lower.includes('شتو') || lower === 'winter') key = 'winter';
      else if (lower.includes('صيف') || lower === 'summer') key = 'summer';
      else if (lower.includes('ربيع') || lower === 'spring') key = 'spring';
      const idx = order.indexOf(key as any);
      return idx >= 0 ? idx : 90;
    };

    allProducts.sort((a, b) => getSeasonWeight(a.season) - getSeasonWeight(b.season));
    return allProducts;
  }, [catalog, searchQuery, selectedSeason, storeSettings.hideOutOfStock, storeSettings.seasonsOrder]);

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
    setLightboxOpen(false);
  };

  // Cycle through options in the set (AliExpress / Temu style)
  const handleNextOption = () => {
    if (!activeProduct || activeProduct.options.length <= 1) return;
    const currentIndex = activeProduct.options.findIndex((o) => o.id === selectedOption?.id);
    const nextIndex = (currentIndex + 1) % activeProduct.options.length;
    setSelectedOption(activeProduct.options[nextIndex]);
  };

  const handlePrevOption = () => {
    if (!activeProduct || activeProduct.options.length <= 1) return;
    const currentIndex = activeProduct.options.findIndex((o) => o.id === selectedOption?.id);
    const prevIndex = (currentIndex - 1 + activeProduct.options.length) % activeProduct.options.length;
    setSelectedOption(activeProduct.options[prevIndex]);
  };

  // Touch swipe support for mobile gallery
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        handleNextOption();
      } else {
        handlePrevOption();
      }
    }
    touchStartXRef.current = null;
  };

  // Fabric & Delivery calculations
  const currentPrice = selectedOption?.price || activeProduct?.defaultPrice || 0;
  const fabricSubtotal = currentPrice * customMeters;
  const deliveryFee = deliveryType === 'توصيل' 
    ? (customerLocation ? (customerLocation.lat > 26.24 && customerLocation.lng > 50.59 ? 2.000 : (customerLocation.lng < 50.51 && customerLocation.lat >= 26.12 ? 0.500 : 1.000)) : 1.000)
    : 0;
  const estimatedGrandTotal = fabricSubtotal + deliveryFee;

  // Exact WhatsApp Link format with Location Pin & 3 decimals
  const getWhatsAppLink = (product?: StoreProduct, option?: StoreFabricOption, meters?: number) => {
    const targetProduct = product || activeProduct;
    const targetOption = option || selectedOption;

    if (!targetProduct || !targetOption) {
      const generalMsg = `السلام عليكم ورحمة الله وبركاته، دار نَسْجَة للأقمشة الفاخرة\nأود الاستفسار عن تشكيلة الأقمشة المتاحة لديكم.`;
      return `https://wa.me/${whatsAppPhone}?text=${encodeURIComponent(generalMsg)}`;
    }

    const defaultMeters = meters !== undefined ? meters : customMeters;
    const formattedMetersStr = Number(defaultMeters).toString();
    const unitPriceStr = Number(targetOption.price).toFixed(3);
    const fabricTotalStr = (targetOption.price * defaultMeters).toFixed(3);
    const activeDeliveryFee = deliveryFee;
    const grandTotalStr = ((targetOption.price * defaultMeters) + activeDeliveryFee).toFixed(3);

    let deliveryMethodStr = 'استلام شخصي من المقر (0.000 د.ب)';
    let deliveryFeeLine = '• رسوم التوصيل: 0.000 د.ب (استلام شخصي من المقر)';

    if (deliveryType === 'توصيل') {
      const mapsLink = customerLocation
        ? `https://maps.google.com/?q=${customerLocation.lat.toFixed(6)},${customerLocation.lng.toFixed(6)}`
        : 'سيتم تزويدكم باللوكيشن المباشر عبر المحادثة';

      deliveryMethodStr = `خدمة التوصيل بمملكة البحرين\n• رابط موقع التوصيل (Google Maps):\n  ${mapsLink}`;
      if (deliveryNotes.trim()) {
        deliveryMethodStr += `\n• تفاصيل إضافية للعنوان: ${deliveryNotes.trim()}`;
      }
      deliveryFeeLine = `• رسوم التوصيل: +${activeDeliveryFee.toFixed(3)} د.ب`;
    }

    const msg = `السلام عليكم ورحمة الله وبركاته، دار نَسْجَة للأقمشة الفاخرة
أود طلب القماش الآتي:
• اسم القماش: ${targetOption.fullName}
• سعر المتر: ${unitPriceStr} د.ب
• عدد الأمتار: ${formattedMetersStr} متر
• قيمة القماش: ${fabricTotalStr} د.ب
• طريقة الاستلام: ${deliveryMethodStr}
${deliveryFeeLine}
• الإجمالي النهائي: ${grandTotalStr} د.ب`;

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
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-4 sm:gap-8 text-[11px] sm:text-xs font-bold text-[#1D3A30]/85 overflow-x-auto no-scrollbar whitespace-nowrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Truck className="w-3.5 h-3.5 text-[#A99872]" />
            <span>توصيل لكافة المناطق</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#A99872]" />
            <span>أفخر خامات الأقمشة الرجالية</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
            <span>طلب مباشر عبر واتساب</span>
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

      {/* 3.5 LUXURY SEASON / CATEGORY NAVIGATION TABS */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-1 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
          {seasonTabs.map((tab) => {
            const isActive = selectedSeason === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedSeason(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer shadow-2xs ${
                  isActive
                    ? 'bg-[#1D3A30] text-[#E8D5A8] border-2 border-[#C7B895] shadow-sm scale-[1.02]'
                    : 'bg-white text-[#1D3A30] border border-[#C7B895]/40 hover:border-[#1D3A30]/50 hover:bg-[#FAF7F0]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#E8D5A8]' : 'text-[#A99872]'}`} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-[#E8D5A8]/20 text-[#E8D5A8] border border-[#E8D5A8]/40'
                        : 'bg-[#FAF7F0] text-[#1D3A30]/70 border border-[#C7B895]/30'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
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
              {searchQuery
                ? `لم يتم العثور على أقمشة تطابق "${searchQuery}"`
                : selectedSeason !== 'all'
                ? `لا توجد أقمشة مدرجة في هذا القسم حالياً`
                : 'لا توجد أقمشة متوفرة حالياً'}
            </h3>
            {(searchQuery || selectedSeason !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSeason('all');
                }}
                className="px-5 py-2 bg-[#1D3A30] text-[#E8D5A8] rounded-xl text-xs font-bold transition shadow-xs cursor-pointer hover:bg-[#1D3A30]/90"
              >
                عرض كافة الأقمشة ✨
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

                    {/* Stock Status & Season Badges */}
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

                      {product.season && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#FAF7F0]/95 text-[#1D3A30] backdrop-blur-xs shadow-xs border border-[#C7B895]/60 flex items-center gap-1">
                          {product.season.includes('ربيع') ? '🌿 ربيعي' : product.season.includes('شتو') ? '❄️ شتوي' : product.season.includes('صيف') ? '☀️ صيفي' : product.season}
                        </span>
                      )}
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
                            {product.defaultPrice.toFixed(3)}
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

              {/* 1. HIGH-RES IMAGE SHOWCASE GALLERY (Temu / AliExpress Style) */}
              <div className="space-y-2">
                <div 
                  className="relative aspect-4/3 sm:aspect-16/10 max-h-72 sm:max-h-80 w-full rounded-2xl overflow-hidden bg-[#FAF7F0] border border-[#C7B895]/40 shadow-xs select-none group"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* The Main High-Res Image */}
                  {(selectedOption?.imageUrl || activeProduct.imageUrl) ? (
                    <img 
                      src={selectedOption?.imageUrl || activeProduct.imageUrl} 
                      alt={selectedOption?.fullName || activeProduct.baseName}
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-102"
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#1D3A30]/40 p-4">
                      <Layers className="w-12 h-12 text-[#A99872] mb-2 opacity-60" />
                      <span className="text-xs font-bold text-[#1D3A30]/60">نَسْجَة للأقمشة الفاخرة</span>
                    </div>
                  )}

                  {/* Gradient Vignette */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />

                  {/* Navigation Chevrons for cycling options */}
                  {activeProduct.isSet && activeProduct.options.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrevOption();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-[#1D3A30] text-white flex items-center justify-center backdrop-blur-xs transition shadow-md active:scale-90 cursor-pointer z-10"
                        title="القماش السابق"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNextOption();
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-[#1D3A30] text-white flex items-center justify-center backdrop-blur-xs transition shadow-md active:scale-90 cursor-pointer z-10"
                        title="القماش التالي"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Top-Right Badges: Season & Option Counter */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                    {activeProduct.season && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF7F0]/95 text-[#1D3A30] border border-[#C7B895]/60 shadow-xs backdrop-blur-xs">
                        {activeProduct.season.includes('ربيع') ? '🌿 ربيعي' : activeProduct.season.includes('شتو') ? '❄️ شتوي' : activeProduct.season.includes('صيف') ? '☀️ صيفي' : activeProduct.season}
                      </span>
                    )}

                    {activeProduct.isSet && activeProduct.options.length > 1 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#1D3A30]/90 text-[#E8D5A8] border border-[#C7B895]/40 shadow-xs backdrop-blur-xs">
                        #{selectedOption?.itemNumber} من {activeProduct.options.length}
                      </span>
                    )}
                  </div>

                  {/* Top-Left: Lightbox Zoom Button */}
                  {(selectedOption?.imageUrl || activeProduct.imageUrl) && (
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/50 hover:bg-[#1D3A30] text-white text-[10px] font-bold backdrop-blur-xs transition shadow-xs flex items-center gap-1 cursor-pointer z-10"
                      title="تكبير الصورة بأعلى دقة"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-[#E8D5A8]" />
                      <span>تكبير</span>
                    </button>
                  )}

                  {/* Bottom Text Overlay */}
                  <div className="absolute bottom-2.5 inset-x-3 flex items-end justify-between z-10 text-white">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black text-white truncate drop-shadow-sm">
                        {selectedOption?.fullName || activeProduct.baseName}
                      </h3>
                      {activeProduct.isSet && activeProduct.options.length > 1 && (
                        <p className="text-[10px] text-[#E8D5A8] font-bold">
                          اسحب لليمين أو اليسار للتنقل بين الأقمشة
                        </p>
                      )}
                    </div>
                    <div className="bg-[#1D3A30]/90 border border-[#C7B895]/50 px-2.5 py-1 rounded-xl shadow-xs font-mono text-xs font-black text-[#E8D5A8] flex-shrink-0">
                      {(selectedOption?.price || activeProduct.defaultPrice).toFixed(3)} د.ب / م
                    </div>
                  </div>
                </div>

                {/* Lightbox Modal (Full-Screen High-Resolution Inspection) */}
                <AnimatePresence>
                  {lightboxOpen && (selectedOption?.imageUrl || activeProduct.imageUrl) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out"
                      onClick={() => setLightboxOpen(false)}
                    >
                      <div className="absolute top-4 right-4 z-50">
                        <button
                          type="button"
                          onClick={() => setLightboxOpen(false)}
                          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      <img
                        src={selectedOption?.imageUrl || activeProduct.imageUrl}
                        alt={selectedOption?.fullName || activeProduct.baseName}
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <p className="text-white/80 text-xs font-bold mt-3 text-center">
                        {selectedOption?.fullName || activeProduct.baseName} — جودة فائقة وتفاصيل الخياطة
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 2. THUMBNAIL STRIP (Temu / AliExpress Style) */}
                {activeProduct.isSet && activeProduct.options.length > 1 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#1D3A30]">
                      <span className="flex items-center gap-1.5">
                        <span>خيارات المجموعة:</span>
                        <span className="text-[#A99872] text-[10px]">({activeProduct.options.length} أقمشة)</span>
                      </span>
                      <span className="text-[10px] text-[#A99872] font-mono font-bold">
                        المحدد: #{selectedOption?.itemNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1.5 px-0.5">
                      {activeProduct.options.map((opt) => {
                        const isSelected = selectedOption?.id === opt.id;
                        const isOut = opt.isOutOfStock;
                        const thumbImg = opt.imageUrl || activeProduct.imageUrl;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={isOut}
                            onClick={() => {
                              if (!isOut) setSelectedOption(opt);
                            }}
                            className={`relative flex-shrink-0 w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer group active:scale-95 ${
                              isOut
                                ? 'opacity-40 border-stone-200 cursor-not-allowed'
                                : isSelected
                                ? 'border-[#1D3A30] ring-2 ring-[#C7B895] shadow-md scale-105'
                                : 'border-[#C7B895]/40 hover:border-[#1D3A30]/60 bg-white'
                            }`}
                            title={opt.fullName}
                          >
                            {thumbImg ? (
                              <img src={thumbImg} alt={opt.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#FAF7F0] text-[#1D3A30]/40 text-xs font-bold">
                                {opt.itemNumber}
                              </div>
                            )}

                            {/* Number badge on thumbnail */}
                            <div className={`absolute bottom-0 inset-x-0 py-0.5 text-center text-[10px] font-black font-mono transition-colors ${
                              isSelected ? 'bg-[#1D3A30] text-[#E8D5A8]' : 'bg-black/60 text-white'
                            }`}>
                              {opt.itemNumber}
                            </div>

                            {isOut && (
                              <div className="absolute inset-0 bg-stone-900/65 flex items-center justify-center text-white text-[9px] font-bold">
                                نفد
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Description if available */}
              {(selectedOption?.description || activeProduct.description) && (
                <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#C7B895]/30 text-xs text-[#1D3A30]/85 leading-relaxed font-medium">
                  {selectedOption?.description || activeProduct.description}
                </div>
              )}

              {/* NUMBERED SELECTION GRID (Shows ONLY the number: 1, 2, 3...) */}
              {activeProduct.isSet && activeProduct.options.length > 1 && (
                <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#1D3A30]">
                      اختر رقم القماش:
                    </label>
                    <span className="text-[10px] text-[#A99872] font-mono font-bold">
                      المحدد: #{selectedOption?.itemNumber}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-5 gap-1.5">
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
                          className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                            isOut
                              ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-70'
                              : isSelected
                              ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs scale-[1.02]'
                              : 'bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]'
                          }`}
                        >
                          <span className="text-sm font-black font-mono">{opt.itemNumber}</span>
                          {isOut ? (
                            <span className="text-[8px] font-bold text-rose-600">نفد</span>
                          ) : (
                            <span className={`text-[9px] font-mono ${isSelected ? 'text-[#E8D5A8]' : 'text-[#A99872] font-bold'}`}>
                              {opt.price.toFixed(3)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. HORIZONTAL METERS SLIDER (Mathematically aligned ticks & steppers) */}
              <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black text-[#1D3A30]">
                      حدد عدد الأمتار المطلوبة:
                    </label>
                    <span className="text-[10px] text-[#A99872] font-semibold">
                      حرك المؤشر الأفقي (أقل حد 1 متر)
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

                {/* The Horizontal Range Slider with mathematically aligned ticks */}
                <div className="space-y-2 pt-1" dir="ltr">
                  <div className="relative w-full">
                    <input
                      type="range"
                      min={1.0}
                      max={25.0}
                      step={0.5}
                      value={customMeters}
                      onChange={(e) => setCustomMeters(parseFloat(e.target.value))}
                      className="w-full accent-[#1D3A30] cursor-pointer h-2.5 bg-[#E8D5A8]/50 rounded-lg relative z-10"
                    />
                  </div>

                  {/* Geometrically aligned tick marks and labels */}
                  <div className="relative w-full h-7 select-none">
                    {[
                      { val: 1.0, label: '1 م' },
                      { val: 3.5, label: '3.5 م (ثوب كامل)' },
                      { val: 10.0, label: '10 م' },
                      { val: 22.5, label: '22.5 م (طاقة)' },
                    ].map((tick) => {
                      const pct = ((tick.val - 1.0) / (25.0 - 1.0)) * 100;
                      const isSelected = Math.abs(customMeters - tick.val) < 0.25;
                      return (
                        <div
                          key={tick.val}
                          onClick={() => setCustomMeters(tick.val)}
                          className="absolute -translate-x-1/2 flex flex-col items-center cursor-pointer transition-all group"
                          style={{ left: `${pct}%` }}
                        >
                          <div
                            className={`w-0.5 rounded-full mb-0.5 transition-all ${
                              isSelected ? 'h-2.5 bg-[#1D3A30]' : 'h-1.5 bg-[#C7B895]/80 group-hover:bg-[#1D3A30]'
                            }`}
                          />
                          <span
                            className={`text-[9px] font-mono whitespace-nowrap transition-all ${
                              isSelected
                                ? 'text-[#1D3A30] font-black scale-105'
                                : 'text-[#1D3A30]/65 font-bold group-hover:text-[#1D3A30]'
                            }`}
                          >
                            {tick.label}
                          </span>
                        </div>
                      );
                    })}
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

              {/* 4. RECEIVING MECHANISM (استلام من المقر / خدمة التوصيل بالخريطة) */}
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
                    <span>استلام من المقر</span>
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
                    <span>خدمة التوصيل بالبحرين</span>
                  </button>
                </div>

                {deliveryType === 'قدوم شخصي' ? (
                  <div className="p-2.5 rounded-xl bg-[#FAF7F0] border border-[#C7B895]/30 text-[11px] text-[#1D3A30]/80 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#A99872] flex-shrink-0" />
                    <span>الاستلام من المقر — سنقوم بتزويدك بالموقع الدقيق عبر واتساب فور تأكيد الطلب للتنسيق.</span>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-2 border-t border-[#C7B895]/30 space-y-3"
                  >
                    {/* Interactive Google / OpenStreetMap Location Picker with GPS Auto-detection */}
                    <div>
                      <label className="text-[11px] font-bold text-[#1D3A30] flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#A99872]" />
                          <span>موقع التوصيل عبر الخريطة والـ GPS:</span>
                        </span>
                        <span className="text-[10px] text-[#A99872] font-mono font-bold">
                          رسوم التوصيل: +{deliveryFee.toFixed(3)} د.ب
                        </span>
                      </label>

                      <LocationPickerMap
                        location={customerLocation}
                        onChange={(loc) => setCustomerLocation(loc)}
                      />
                    </div>

                    {/* Simple optional delivery notes input */}
                    <div>
                      <label className="text-[10px] text-[#1D3A30]/80 font-bold block mb-1">
                        ملاحظات أو تفاصيل إضافية للعنوان (اختياري):
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: رقم الشقة / المبنى / علامة مميزة قرب المنزل..."
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs bg-white text-[#1D3A30] shadow-2xs placeholder:text-[#1D3A30]/35 font-medium"
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF7F0] border border-[#C7B895]/30 text-[11px] text-[#1D3A30] flex items-center justify-between">
                      <span className="font-bold">رسوم خدمة التوصيل بمملكة البحرين:</span>
                      <span className="font-mono font-bold text-[#1D3A30]">+{deliveryFee.toFixed(3)} د.ب</span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* 5. PRICE CALCULATION SUMMARY (Strict 3-Decimal Calculation, NO "مجاناً") */}
              <div className="p-4 rounded-2xl bg-[#1D3A30] text-[#FAF7F0] space-y-2 shadow-sm border border-[#C7B895]/30">
                <div className="flex items-center justify-between text-xs text-[#FAF7F0]/80">
                  <span>قيمة القماش ({customMeters} متر):</span>
                  <span className="font-mono font-bold">{fabricSubtotal.toFixed(3)} د.ب</span>
                </div>
                {deliveryType === 'توصيل' ? (
                  <div className="flex items-center justify-between text-[11px] text-[#E8D5A8]/90">
                    <span>رسوم التوصيل:</span>
                    <span className="font-mono font-bold">+{deliveryFee.toFixed(3)} د.ب</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-[#E8D5A8]/90">
                    <span>رسوم التوصيل (استلام من المقر):</span>
                    <span className="font-mono font-bold">0.000 د.ب</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-1 border-t border-[#C7B895]/20">
                  <span className="text-xs font-extrabold text-[#E8D5A8]">
                    السعر الإجمالي النهائي:
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white font-mono">{estimatedGrandTotal.toFixed(3)}</span>
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
