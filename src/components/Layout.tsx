import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, ShoppingBag, Layers, Receipt, TrendingUp, 
  LogOut, Calendar, Instagram, RefreshCw, Cloud,
  ShieldCheck, Store, Sliders, Menu, X, ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { syncWithServer, getCloudData, EVENT_DATA_UPDATED } from '../lib/dataService';
import NasjahLogo from './NasjahLogo';
import { PWAInstallButton } from './PWAInstallButton';

export default function Layout() {
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleManualSync = async () => {
    if (isSyncingData) return;
    setIsSyncingData(true);
    try {
      await syncWithServer();
      updateBadges();
      // Ensure any service worker caches or stale files are bypassed and page is refreshed
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.update().catch(() => {});
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name))).catch(() => {});
      }
      // Force reload from server bypassing browser cache
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      });
    }
  }, []);

  // Close menu on page navigation
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Load badge and summary data purely from cloud state
  const updateBadges = () => {
    try {
      const { orders, inventory, customProfits } = getCloudData();
      const pending = orders.filter((o: any) => o.status === 'قيد التجهيز' || o.status === 'جاهز للتسليم').length;
      setPendingOrdersCount(pending);
      const ordersSales = orders
        .filter((o: any) => o.paymentStatus !== 'قيد الدفع' && o.status !== 'ملغي')
        .reduce((sum: number, o: any) => sum + (o.total || o.price || 0), 0);
      const manualProfits = (customProfits || [])
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      setTotalSales(ordersSales + manualProfits);

      const lowStock = inventory.filter((f: any) => {
        const qty = Number(f.quantity) || 0;
        return f.category === 'تغليف' ? qty <= 10 : qty < 3.5;
      }).length;
      setLowStockCount(lowStock);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    updateBadges();
    syncWithServer().then(() => updateBadges());

    const handleUpdate = () => updateBadges();
    window.addEventListener(EVENT_DATA_UPDATED, handleUpdate);
    const interval = setInterval(updateBadges, 4000);

    return () => {
      window.removeEventListener(EVENT_DATA_UPDATED, handleUpdate);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    updateBadges();
  }, [location.pathname]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    navigate('/login');
  };

  const navItems = [
    { name: 'الرئيسية', path: '/', icon: Home },
    { 
      name: 'الطلبات', 
      path: '/orders', 
      icon: ShoppingBag,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
      badgeColor: 'bg-[#C7B895] text-[#1D3A30]'
    },
    { 
      name: 'المخزون', 
      path: '/inventory', 
      icon: Layers,
      badge: lowStockCount > 0 ? '!' : null,
      badgeColor: 'bg-amber-600 text-white'
    },
    { name: 'المصروفات', path: '/expenses', icon: Receipt },
    { name: 'إعدادات المتجر', path: '/store-settings', icon: Sliders },
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return '';
      case '/orders': return 'الطلبات';
      case '/inventory': return 'المخزون';
      case '/expenses': return 'المصروفات';
      case '/budget': return 'الميزانية';
      case '/store-settings': return 'إعدادات المتجر';
      case '/settings': return 'الأمان';
      default: return '';
    }
  };

  const pageTitle = getPageTitle();
  // Only home dashboard is static viewport, Budget and others can scroll
  const isStaticPage = location.pathname === '/';

  const todayFormatted = new Date().toLocaleDateString('ar-BH', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-[#FAF7F0] text-[#1D3A30] font-sans flex flex-col select-none" dir="rtl">
      
      {/* ========================================================================= */}
      {/* 1. DESKTOP & TABLET TOP HEADER BAR (md: and up)                           */}
      {/* ========================================================================= */}
      <header className="hidden md:flex h-16 bg-[#1D3A30] text-[#FAF7F0] px-6 lg:px-8 items-center justify-between border-b border-[#C7B895]/30 shadow-[0_2px_12px_rgba(0,0,0,0.12)] flex-shrink-0 z-30">
        {/* Brand Logo & Title */}
        <Link to="/" className="flex items-center gap-3.5 hover:opacity-95 transition cursor-pointer">
          <NasjahLogo variant="emblem" size="sm" className="ring-2 ring-[#C7B895]/50 shadow-sm" />
          <div className="flex flex-col text-right">
            <span className="font-extrabold text-base tracking-wider text-[#FAF7F0] font-sans leading-tight">
              نَسْجَة
            </span>
            <span className="text-[10px] text-[#C7B895] font-medium tracking-wide">
              أقمشة وخياطة رجالية
            </span>
          </div>
        </Link>

        {/* Current Active Page Title Indicator */}
        {pageTitle ? (
          <div className="flex items-center gap-2 bg-[#25493D]/80 px-4 py-1.5 rounded-full border border-[#C7B895]/35 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#E8D5A8] shadow-[0_0_8px_rgba(232,213,168,0.6)]" />
            <span className="text-xs font-bold text-[#FAF7F0] tracking-wide">{pageTitle}</span>
          </div>
        ) : <div />}

        {/* Streamlined Clean Header Actions (Customer Store & Menu) */}
        <div className="flex items-center gap-3">
          
          {/* Direct Customer Storefront Link */}
          <Link
            to="/store"
            target="_blank"
            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-l from-[#C7B895] to-[#E8D5A8] hover:from-[#B5A57F] hover:to-[#D8CCB0] text-[#1D3A30] rounded-xl border border-[#C7B895]/50 text-xs font-extrabold transition duration-150 active:scale-95 shadow-xs cursor-pointer"
            title="معاينة متجر الزبائن العام في نافذة جديدة"
          >
            <Store className="w-4 h-4 text-[#1D3A30]" />
            <span>متجر الزبائن</span>
            <ExternalLink className="w-3 h-3 text-[#1D3A30]/70" />
          </Link>

          {/* THE UNIFIED MENU BUTTON */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#25493D] hover:bg-[#2E584A] text-[#E8D5A8] rounded-xl border border-[#C7B895]/40 text-xs font-bold transition duration-150 active:scale-95 cursor-pointer shadow-xs"
            title="فتح القائمة الرئيسية وإعدادات المتجر"
          >
            <Menu className="w-4 h-4 text-[#E8D5A8]" />
            <span>القائمة</span>
          </button>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MOBILE APP HEADER (Visible ONLY on mobile < md, width < 768px)         */}
      {/* ========================================================================= */}
      <header className="flex md:hidden h-14 bg-[#1D3A30] text-[#FAF7F0] px-3.5 items-center justify-between flex-shrink-0 z-30 shadow-xs border-b border-[#C7B895]/25">
        <Link to="/" className="flex items-center gap-2.5 cursor-pointer">
          <NasjahLogo variant="emblem" size="sm" className="ring-1 ring-[#C7B895]/40" />
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-wider text-[#FAF7F0] font-sans leading-tight">
              نَسْجَة
            </span>
            {pageTitle ? (
              <p className="text-[10px] text-[#C7B895] font-medium leading-none mt-0.5">
                {pageTitle}
              </p>
            ) : (
              <span className="text-[9px] text-[#C7B895]/80 font-normal leading-none mt-0.5">
                أقمشة وخياطة رجالية
              </span>
            )}
          </div>
        </Link>

        {/* Mobile Header Actions: Store preview & The Menu Button */}
        <div className="flex items-center gap-2">
          <Link
            to="/store"
            target="_blank"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-[#C7B895] to-[#E8D5A8] text-[#1D3A30] transition border border-[#C7B895]/40 text-[11px] font-black active:scale-95 cursor-pointer shadow-2xs"
            title="متجر الزبائن"
          >
            <Store className="w-3.5 h-3.5 text-[#1D3A30]" />
            <span>المتجر</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#25493D] hover:bg-[#2E584A] text-[#E8D5A8] transition border border-[#C7B895]/40 active:scale-95 cursor-pointer text-xs font-bold shadow-2xs"
            title="القائمة والإعدادات"
          >
            <Menu className="w-4 h-4 text-[#E8D5A8]" />
            <span>القائمة</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN VIEWPORT CONTENT (Fluid & responsive across all screens)          */}
      {/* ========================================================================= */}
      <main className="flex-1 p-2 sm:p-3 lg:p-4 relative bg-[#FAF7F0] flex flex-col overflow-y-auto pb-24 no-scrollbar">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0">
          <Outlet />
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. UNIVERSAL BOTTOM NAVIGATION BAR (Desktop, Tablet & Mobile)            */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[#C7B895]/30 shadow-[0_-4px_25px_rgba(29,58,48,0.09)] px-2 sm:px-6 py-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <nav className="w-full max-w-4xl mx-auto flex items-center justify-around gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col sm:flex-row items-center justify-center flex-1 py-1.5 sm:py-2 px-1 sm:px-3 rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer gap-1 sm:gap-2",
                  isActive 
                    ? "text-[#1D3A30] font-bold" 
                    : "text-[#1D3A30]/60 hover:text-[#1D3A30] hover:bg-[#FAF7F0] font-medium"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="universalBottomIndicator"
                    className="absolute inset-0 bg-[#E8D5A8]/45 rounded-2xl -z-10 border border-[#C7B895]/40 shadow-xs"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <div className="relative flex items-center justify-center">
                  <Icon className={cn("w-5 h-5 sm:w-5.5 sm:h-5.5 transition-transform", isActive && "scale-105 text-[#1D3A30]")} />
                  {item.badge && (
                    <span className={cn(
                      "absolute -top-1.5 -right-2 text-[9px] font-bold min-w-[15px] h-[15px] flex items-center justify-center rounded-full px-0.5 shadow-xs",
                      item.badgeColor
                    )}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-bold mt-0.5 sm:mt-0 tracking-tight leading-none truncate max-w-full">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* 5. THE UNIFIED ATELIER MENU SLIDE-OVER DRAWER (Requested Menu Modal)      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-50 flex items-stretch justify-start" dir="rtl">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            />

            {/* Menu Slide-Over Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative w-full max-w-sm sm:max-w-md bg-[#FAF7F0] h-full shadow-2xl flex flex-col z-10 border-l border-[#C7B895]/40 overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="bg-[#1D3A30] text-[#FAF7F0] p-4 sm:p-5 flex items-center justify-between border-b border-[#C7B895]/30">
                <div className="flex items-center gap-3">
                  <NasjahLogo variant="emblem" size="md" className="ring-2 ring-[#C7B895]/60 shadow-md" />
                  <div>
                    <h2 className="text-base font-black text-[#FAF7F0] tracking-wide">
                      نَسْجَة • قائمة المنظومة
                    </h2>
                    <p className="text-[11px] text-[#C7B895] font-medium">
                      إدارة المتجر والأمان والعمليات
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-8 h-8 rounded-xl bg-[#25493D] hover:bg-[#2E584A] text-[#FAF7F0] flex items-center justify-center transition border border-[#C7B895]/30 cursor-pointer"
                  title="إغلاق القائمة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status & Cloud Summary Card */}
              <div className="p-3.5 mx-4 mt-4 bg-white rounded-2xl border border-[#C7B895]/30 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-[#C7B895]" />
                    <span className="font-bold text-[#1D3A30]">حالة السحابة:</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>مزامنة سحابية نشطة</span>
                  </div>
                </div>

                {userEmail && (
                  <div className="text-[11px] text-[#1D3A30]/70 truncate flex items-center justify-between pt-1 border-t border-[#C7B895]/20">
                    <span className="font-medium">الحساب:</span>
                    <span className="font-mono text-[#1D3A30] font-bold">{userEmail}</span>
                  </div>
                )}

                <div className="text-[10px] text-[#A99872] flex items-center gap-1 pt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{todayFormatted}</span>
                </div>
              </div>

              {/* Navigation Links in Drawer */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                
                {/* 1. STORE SETTINGS (Requested as button in this menu) */}
                <Link
                  to="/store-settings"
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs group",
                    location.pathname === '/store-settings'
                      ? "bg-[#1D3A30] text-[#FAF7F0] border-[#1D3A30]"
                      : "bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border-[#C7B895]/35 hover:border-[#1D3A30]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition shadow-2xs",
                      location.pathname === '/store-settings'
                        ? "bg-[#25493D] text-[#E8D5A8]"
                        : "bg-[#FAF7F0] text-[#1D3A30] group-hover:bg-[#1D3A30] group-hover:text-[#FAF7F0]"
                    )}>
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black">إعدادات المتجر</h3>
                      <p className={cn(
                        "text-[10px] sm:text-[11px]",
                        location.pathname === '/store-settings' ? "text-[#C7B895]" : "text-[#1D3A30]/65"
                      )}>
                        رقم الواتساب، ترتيب الأقمشة، والمواسم
                      </p>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-[#C7B895] group-hover:-translate-x-1 transition-transform" />
                </Link>

                {/* 2. SECURITY & CONNECTED DEVICES */}
                <Link
                  to="/settings"
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs group",
                    location.pathname === '/settings'
                      ? "bg-[#1D3A30] text-[#FAF7F0] border-[#1D3A30]"
                      : "bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border-[#C7B895]/35 hover:border-[#1D3A30]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition shadow-2xs",
                      location.pathname === '/settings'
                        ? "bg-[#25493D] text-emerald-400"
                        : "bg-[#FAF7F0] text-emerald-700 group-hover:bg-[#1D3A30] group-hover:text-emerald-400"
                    )}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black">الأمان والأجهزة المصرحة</h3>
                      <p className={cn(
                        "text-[10px] sm:text-[11px]",
                        location.pathname === '/settings' ? "text-[#C7B895]" : "text-[#1D3A30]/65"
                      )}>
                        تأمين الحساب، الجلسات، وسجل الأجهزة
                      </p>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-[#C7B895] group-hover:-translate-x-1 transition-transform" />
                </Link>

                {/* 3. CUSTOMER STOREFRONT PREVIEW */}
                <Link
                  to="/store"
                  target="_blank"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border border-[#C7B895]/35 hover:border-[#1D3A30] transition-all cursor-pointer shadow-xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C7B895] to-[#E8D5A8] text-[#1D3A30] flex items-center justify-center shadow-2xs">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black">معاينة متجر الزبائن</h3>
                      <p className="text-[10px] sm:text-[11px] text-[#1D3A30]/65">
                        فتح واجهة المتجر في نافذة مستقلة
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#C7B895]" />
                </Link>

                {/* 4. INSTAGRAM CHANNEL */}
                <a
                  href="https://instagram.com/nasjah.bh"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border border-[#C7B895]/35 hover:border-[#1D3A30] transition-all cursor-pointer shadow-xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-700 flex items-center justify-center shadow-2xs">
                      <Instagram className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black">حساب إنستغرام نَسْجَة</h3>
                      <p className="text-[10px] sm:text-[11px] text-[#1D3A30]/65">
                        @nasjah.bh
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#C7B895]" />
                </a>

                {/* 5. MANUAL CLOUD SYNC */}
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncingData}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-[#FAF7F0] text-[#1D3A30] border border-[#C7B895]/35 hover:border-[#1D3A30] transition-all cursor-pointer shadow-xs disabled:opacity-75"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF7F0] text-[#1D3A30] flex items-center justify-center shadow-2xs">
                      <RefreshCw className={cn("w-5 h-5 text-[#C7B895]", isSyncingData && "animate-spin text-[#1D3A30]")} />
                    </div>
                    <div className="text-right">
                      <h3 className="text-xs sm:text-sm font-black">
                        {isSyncingData ? 'جارِ المزامنة السحابية...' : 'مزامنة البيانات فورياً'}
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-[#1D3A30]/65">
                        تحديث الذاكرة وقاعدة البيانات المركزية
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#A99872] bg-[#FAF7F0] px-2 py-0.5 rounded-lg border border-[#C7B895]/30">
                    تحديث
                  </span>
                </button>

                {/* 6. PWA INSTALL (If available) */}
                <div className="pt-1">
                  <PWAInstallButton />
                </div>

              </div>

              {/* Drawer Footer with Logout */}
              <div className="p-4 bg-white border-t border-[#C7B895]/25">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-98"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>تسجيل الخروج من المنظومة</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
