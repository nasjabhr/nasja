import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, ChevronLeft, Check, Clock, CheckCircle2,
  Plus, Trash2, Edit3, X, Wallet
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../lib/dateUtils';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { 
  getLocalData, 
  persistOrders, 
  syncWithServer, 
  EVENT_DATA_UPDATED,
  persistCapital,
  addCustomProfit,
  deleteCustomProfitPermanently
} from '../lib/dataService';
import { CustomProfit } from '../types';

export default function Dashboard() {
  const [sales, setSales] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [pendingPaymentSales, setPendingPaymentSales] = useState(0);
  const [capital, setCapital] = useState(0);
  const [customProfits, setCustomProfits] = useState<CustomProfit[]>([]);

  // Budget & Capital Drawer / Modal state
  const [isBudgetDrawerOpen, setIsBudgetDrawerOpen] = useState(false);
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const [capitalInput, setCapitalInput] = useState('');
  
  // Reimbursed Inflows / Custom Inflow state (مبالغ مستردة وإيرادات مؤقتة وليست زيادة على رأس المال)
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundDesc, setFundDesc] = useState('');
  const [fundCategory, setFundCategory] = useState('استرداد مشتريات شخصية');
  const [fundDate, setFundDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [ordersSalesOnly, setOrdersSalesOnly] = useState(0);

  const reloadDashboardData = useCallback(() => {
    const local = getLocalData();
    setOrders(local.orders || []);
    setCapital(Number(local.capital) || 0);
    setCustomProfits(local.customProfits || []);

    // Strictly count paid orders that are NOT cancelled in sales
    const paidOrders = (local.orders || [])
      .filter((order: any) => order.paymentStatus === 'تم الدفع' && order.status !== 'ملغي');
    const ordersSales = paidOrders
      .reduce((sum: number, order: any) => sum + (order.total || order.price || 0), 0) || 0;
    setOrdersSalesOnly(ordersSales);
    
    // Inflows from reimbursed personal items or temporary project deposits
    const addedInflowsTotal = (local.customProfits || [])
      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    
    // Total revenues = Merchandise sales + Reimbursed inflows
    const totalRevenues = ordersSales + addedInflowsTotal;
    setSales(totalRevenues);

    const pendingSales = (local.orders || [])
      .filter((order: any) => (order.paymentStatus === 'قيد الدفع' || order.paymentStatus === 'آجل') && order.status !== 'ملغي')
      .reduce((sum: number, order: any) => sum + (order.total || order.price || 0), 0) || 0;
    setPendingPaymentSales(pendingSales);

    const totalExp = (local.expenses || []).reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0) || 0;
    setExpenses(totalExp);

    return { totalSales: totalRevenues, totalExp, local };
  }, []);

  useEffect(() => {
    reloadDashboardData();

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('budget') === 'open' || searchParams.get('openBudget') === 'true') {
      setIsBudgetDrawerOpen(true);
    }

    syncWithServer().then(() => {
      reloadDashboardData();
    });

    const handleDataEvent = () => {
      reloadDashboardData();
    };

    window.addEventListener(EVENT_DATA_UPDATED, handleDataEvent);

    return () => {
      window.removeEventListener(EVENT_DATA_UPDATED, handleDataEvent);
    };
  }, [reloadDashboardData]);

  const netProfit = sales - expenses;
  const pendingOrders = orders.filter(o => o.status === 'قيد التجهيز' || o.status === 'جاهز للتسليم');
  const deliveredOrdersCount = orders.filter(o => o.status === 'تم التسليم').length;

  // Capital & Inflows calculations (المبالغ المستردة لا تزيد رأس المال الأساسي بل تُحسب كإيرادات لحساب المشروع)
  const baseCapital = capital || 0;
  const reimbursedInflows = customProfits.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const netOperatingFlow = sales - expenses;
  const availableLiquidity = baseCapital + sales - expenses;

  const handleDeliverOrder = (orderId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const updated = orders.map((o) => {
      if (o.id === orderId) {
        return { ...o, status: 'تم التسليم' };
      }
      return o;
    });
    setOrders(updated);
    persistOrders(updated);
  };

  const handleStartEditCapital = () => {
    setCapitalInput(baseCapital > 0 ? baseCapital.toString() : '');
    setIsEditingCapital(true);
  };

  const handleSaveCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(capitalInput);
    if (!isNaN(parsed) && parsed >= 0) {
      await persistCapital(parsed);
      setCapital(parsed);
      setIsEditingCapital(false);
      reloadDashboardData();
    }
  };

  const handleAddFundsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(fundAmount);
    if (isNaN(amt) || amt <= 0 || !fundDesc.trim()) return;

    await addCustomProfit({
      amount: amt,
      description: fundDesc.trim(),
      category: fundCategory || 'استرداد مشتريات شخصية',
      date: fundDate || new Date().toISOString().split('T')[0]
    });

    setFundAmount('');
    setFundDesc('');
    setFundCategory('استرداد مشتريات شخصية');
    setShowAddFundsModal(false);
    reloadDashboardData();
  };

  const handleDeleteFund = async (id: string) => {
    await deleteCustomProfitPermanently(id);
    reloadDashboardData();
  };

  return (
    <div className="w-full space-y-3 sm:space-y-4 pb-6 select-none font-sans" dir="rtl">
      
      {/* ========================================================================= */}
      {/* 1. TOP SECTION: FINANCIAL METRICS                                         */}
      {/* ========================================================================= */}
      <motion.div 
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-3.5 sm:p-4 rounded-3xl border border-[#C7B895]/25 shadow-[0_2px_12px_rgba(29,58,48,0.03)]"
      >
        <div className="flex justify-between items-center mb-2.5 px-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.7)] animate-pulse" />
            <span className="text-xs sm:text-sm font-extrabold text-[#1D3A30] tracking-tight">
              المؤشرات المالية لنَسْجَة
            </span>
          </div>

          {/* Budget & Capital Settings Button with Arrow */}
          <button 
            type="button"
            onClick={() => setIsBudgetDrawerOpen(true)}
            className="text-[11px] sm:text-xs text-[#1D3A30] hover:text-[#25493D] flex items-center gap-1.5 bg-[#FAF7F0] hover:bg-[#F2ECE0] px-3.5 py-1.5 rounded-full font-bold transition-all border border-[#C7B895]/40 hover:border-[#1D3A30] shadow-2xs active:scale-95 cursor-pointer"
            title="فتح إعدادات الميزانية ورأس المال"
          >
            <span>الميزانية</span>
            <ChevronLeft className="w-3.5 h-3.5 text-[#A99872]" />
          </button>
        </div>

        {/* Net Profit & Operating Flow Display */}
        <div className={`p-3.5 rounded-2xl flex items-center justify-between px-4 sm:px-6 border transition-all shadow-xs ${
          netOperatingFlow >= 0 
            ? 'bg-gradient-to-l from-[#1D3A30] via-[#224438] to-[#1D3A30] text-[#FAF7F0] border-[#C7B895]/40' 
            : 'bg-gradient-to-l from-rose-950 via-rose-900 to-rose-950 text-white border-rose-900'
        }`}>
          <div className="text-right">
            <span className="text-xs sm:text-sm font-black text-[#E8D5A8] tracking-wide block">
              صافي حركة الحساب التشغيلية
            </span>
            <span className="text-[10px] sm:text-[11px] text-[#C7B895] font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8D5A8] inline-block" />
              {reimbursedInflows > 0 
                ? `مبيعات (${ordersSalesOnly.toFixed(2)}) + مستردات (${reimbursedInflows.toFixed(2)}) - مصروفات`
                : (netOperatingFlow >= 0 ? 'أرباح تشغيلية مستقرة' : 'عجز تشغيلي')}
            </span>
          </div>
          <div className="text-left font-mono">
            <span className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-none tracking-tight">
              {netOperatingFlow.toFixed(2)}
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#E8D5A8] mr-1.5">د.ب</span>
          </div>
        </div>

        {/* Sales and Expenses Row */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2.5">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/35 flex items-center justify-between px-3.5 shadow-2xs hover:border-[#C7B895]/60 transition">
            <div>
              <span className="text-[11px] sm:text-xs font-bold text-[#1D3A30] block">
                إجمالي الإيرادات
              </span>
              <span className="text-[9px] sm:text-[10px] text-[#1D3A30]/65 block font-medium mt-0.5">
                {orders.filter((o: any) => o.paymentStatus === 'تم الدفع' && o.status !== 'ملغي').length} طلب محصل
                {reimbursedInflows > 0 && (
                  <span className="text-emerald-800 font-bold mr-1">• {reimbursedInflows.toFixed(2)} مستردات</span>
                )}
                {pendingPaymentSales > 0 && (
                  <span className="text-amber-800 font-bold mr-1">• {pendingPaymentSales.toFixed(2)} معلّق/آجل</span>
                )}
              </span>
            </div>
            <div className="text-left font-mono">
              <span className="text-sm sm:text-base lg:text-lg font-black text-[#1D3A30]">
                +{sales.toFixed(2)}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-[#A99872] mr-1">د.ب</span>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/35 flex items-center justify-between px-3.5 shadow-2xs hover:border-rose-300 transition">
            <div>
              <span className="text-[11px] sm:text-xs font-bold text-rose-800 block">
                إجمالي المصروفات
              </span>
              <Link to="/expenses" className="text-[9px] sm:text-[10px] text-rose-700 hover:text-rose-900 flex items-center gap-0.5 font-semibold mt-0.5">
                سجل المصروفات ←
              </Link>
            </div>
            <div className="text-left font-mono">
              <span className="text-sm sm:text-base lg:text-lg font-black text-rose-700">
                -{expenses.toFixed(2)}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-rose-500 mr-1">د.ب</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ========================================================================= */}
      {/* 2. MIDDLE SECTION: TWO BEAUTIFULLY DESIGNED CARDS                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 w-full items-stretch">
        
        {/* Box 1: إجمالي الطلبات (تصميم متكامل ونظيف يظهر بالكامل على كافة الشاشات) */}
        <div className="bg-white p-4 sm:p-4.5 rounded-3xl border border-[#C7B895]/30 shadow-xs flex flex-col justify-between space-y-2.5">
          <div className="flex justify-between items-center pb-2 border-b border-[#C7B895]/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#FAF7F0] text-[#1D3A30] rounded-xl border border-[#C7B895]/30 flex items-center justify-center flex-shrink-0 shadow-2xs">
                <ShoppingBag className="w-4 h-4 text-[#1D3A30]" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-[#1D3A30] tracking-tight block">
                  إجمالي الطلبات
                </span>
                <p className="text-[10px] text-[#1D3A30]/60 font-medium">
                  سجل العمليات الكلي
                </p>
              </div>
            </div>
            <Link 
              to="/orders" 
              className="text-[10px] sm:text-[11px] font-bold text-[#1D3A30] hover:text-[#25493D] flex items-center gap-0.5 bg-[#FAF7F0] px-2.5 py-1 rounded-lg border border-[#C7B895]/30 hover:bg-[#F2ECE0] transition"
            >
              <span>فتح السجل</span>
              <ChevronLeft className="w-3 h-3 text-[#A99872]" />
            </Link>
          </div>

          {/* Big Number */}
          <div className="text-center py-1">
            <p className="text-4xl sm:text-5xl font-black text-[#1D3A30] font-mono leading-none tracking-tight">
              {orders.length}
            </p>
            <span className="text-[11px] font-bold text-[#A99872] mt-1 inline-block">
              طلب مسجل في المنظومة
            </span>
          </div>

          {/* Breakdown Pills: Side by Side with clear status */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#C7B895]/20">
            <div className="flex items-center justify-between px-2.5 py-2 bg-[#FAF7F0] rounded-xl border border-[#C7B895]/25 text-xs">
              <span className="font-bold text-[#A99872] flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                قيد التجهيز
              </span>
              <span className="font-mono font-black text-[#1D3A30] text-xs sm:text-sm">
                {pendingOrders.length}
              </span>
            </div>

            <div className="flex items-center justify-between px-2.5 py-2 bg-[#FAF7F0] rounded-xl border border-[#C7B895]/25 text-xs">
              <span className="font-semibold text-[#1D3A30]/80 flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                تم تسليمها
              </span>
              <span className="font-mono font-black text-[#1D3A30] text-xs sm:text-sm">
                {deliveredOrdersCount}
              </span>
            </div>
          </div>
        </div>

        {/* Box 2: الطلبات قيد التجهيز */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#C7B895]/30 shadow-xs flex flex-col justify-between space-y-2.5 min-h-[220px]">
          <div className="flex justify-between items-center pb-1 border-b border-[#C7B895]/20">
            <h3 className="font-black text-xs sm:text-sm text-[#1D3A30] flex items-center gap-1.5 tracking-tight">
              <Clock className="w-3.5 h-3.5 text-[#A99872]" />
              الطلبات قيد التجهيز
            </h3>
            <Link to="/orders" className="text-[10px] text-[#1D3A30] font-bold hover:underline flex items-center gap-0.5">
              عرض الكل ({orders.length}) <ChevronLeft className="w-3 h-3 text-[#A99872]" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto pr-0.5 space-y-1.5 no-scrollbar max-h-56">
            {orders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-6">
                <p className="text-xs text-[#1D3A30]/60">لا توجد طلبات مسجلة.</p>
                <Link to="/orders" className="text-[#1D3A30] text-xs font-bold mt-1 inline-block underline">
                  + أضف أول طلب
                </Link>
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center bg-[#FAF7F0] rounded-2xl border border-dashed border-[#C7B895]/40 p-4">
                <div className="w-8 h-8 rounded-full bg-[#1D3A30] text-[#E8D5A8] flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-[#E8D5A8]" />
                </div>
                <p className="text-xs font-bold text-[#1D3A30]">كافة الطلبات مُسلّمة بنجاح!</p>
                <Link to="/orders" className="text-[#1D3A30] text-[10px] font-bold mt-1 inline-block underline">
                  سجل الطلبات
                </Link>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {pendingOrders.slice(0, 4).map((o) => {
                  const { full } = formatDateTime(o.createdAt);
                  const cleanPhone = o.phone?.replace(/[^0-9]/g, '');

                  return (
                    <motion.div 
                      key={o.id} 
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 15, transition: { duration: 0.15 } }}
                      className="p-2 bg-[#FAF7F0] hover:bg-[#F4EBD4]/50 rounded-xl border border-[#C7B895]/25 flex items-center justify-between transition duration-150 gap-1.5 shadow-2xs"
                    >
                      <div className="flex-1 min-w-0 pr-0.5">
                        <span className="font-bold text-xs text-[#1D3A30] truncate block">
                          {o.customerName}
                        </span>
                        <p className="text-[10px] text-[#1D3A30]/75 truncate mt-0.5">
                          {o.details}
                        </p>
                        <p className="text-[8px] text-[#1D3A30]/50 font-mono mt-0.5">
                          {full}
                        </p>
                      </div>

                      <div className="text-left flex-shrink-0 flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#1D3A30] font-mono">
                          {Number(o.price || o.total).toFixed(2)} د.ب
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleDeliverOrder(o.id, e)}
                          title="تم تسليم الطلب"
                          aria-label="تم تسليم الطلب"
                          className="w-6.5 h-6.5 bg-[#1D3A30] hover:bg-[#25493D] active:scale-90 text-[#E8D5A8] rounded-lg flex items-center justify-center transition shadow-2xs border border-[#C7B895]/40 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>

                        {cleanPhone && (
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            title="مراسلة واتساب"
                            aria-label="مراسلة واتساب"
                            className="w-6.5 h-6.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg flex items-center justify-center transition shadow-2xs active:scale-90"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. BUDGET & CAPITAL MODAL / TAB (إعدادات الميزانية ورأس المال والمبالغ المضافة) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isBudgetDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBudgetDrawerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg bg-[#FAF7F0] rounded-3xl shadow-2xl z-10 border border-[#C7B895]/40 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Top Header */}
              <div className="bg-[#1D3A30] text-[#FAF7F0] p-4 sm:p-5 flex items-center justify-between border-b border-[#C7B895]/30 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25493D] text-[#E8D5A8] border border-[#C7B895]/40 flex items-center justify-center shadow-xs">
                    <Wallet className="w-5 h-5 text-[#E8D5A8]" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-[#FAF7F0]">
                      إعدادات الميزانية ورأس المال
                    </h2>
                    <p className="text-[10px] sm:text-[11px] text-[#C7B895]">
                      متابعة رأس المال الأساسي والمبالغ المضافة
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBudgetDrawerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-[#25493D] hover:bg-[#2E584A] text-[#FAF7F0] flex items-center justify-center transition border border-[#C7B895]/30 cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 no-scrollbar">
                
                {/* 1. رأس المال الأساسي (ثابت ولا يزيده شيء) */}
                <div className="bg-white rounded-2xl p-4 border border-[#C7B895]/30 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#1D3A30] block">رأس المال الأساسي</span>
                      <span className="text-[10px] text-[#1D3A30]/60">المبلغ الأولي المخصص لتأسيس المتجر (ثابت لا يزيده شيء)</span>
                    </div>

                    {!isEditingCapital && (
                      <button
                        type="button"
                        onClick={handleStartEditCapital}
                        className="py-1 px-2.5 bg-[#FAF7F0] hover:bg-[#F2ECE0] text-[#1D3A30] border border-[#C7B895]/40 rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3 text-[#A99872]" />
                        <span>تعديل</span>
                      </button>
                    )}
                  </div>

                  {isEditingCapital ? (
                    <form onSubmit={handleSaveCapital} className="pt-2 flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        autoFocus
                        value={capitalInput}
                        onChange={(e) => setCapitalInput(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 px-3 py-1.5 rounded-xl border border-[#1D3A30] bg-white font-mono font-bold text-sm text-[#1D3A30] outline-none"
                      />
                      <button
                        type="submit"
                        className="py-1.5 px-3 bg-[#1D3A30] text-[#E8D5A8] rounded-xl text-xs font-bold cursor-pointer transition active:scale-95"
                      >
                        حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingCapital(false)}
                        className="py-1.5 px-2.5 bg-stone-100 text-stone-700 rounded-xl text-xs font-bold border border-stone-200 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </form>
                  ) : (
                    <div className="pt-1 flex items-baseline gap-1 font-mono">
                      <span className="text-2xl sm:text-3xl font-black text-[#1D3A30]">
                        {baseCapital.toFixed(2)}
                      </span>
                      <span className="text-xs font-bold text-[#A99872]">د.ب</span>
                    </div>
                  )}
                </div>

                {/* 2. إيرادات ومبالغ مستردة & السيولة النقدية المتاحة (بدلاً من إجمالي رأس المال) */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* إيرادات ومبالغ مستردة */}
                  <div className="bg-white rounded-2xl p-3.5 border border-[#C7B895]/30 shadow-2xs text-right">
                    <span className="text-[11px] font-bold text-[#1D3A30] block">إيرادات ومستردات</span>
                    <span className="text-[9px] text-[#1D3A30]/60 block mb-1">مبالغ مودعة كتعويضات/شخصي</span>
                    <div className="font-mono">
                      <span className="text-lg sm:text-xl font-black text-emerald-700 block">
                        +{reimbursedInflows.toFixed(2)} <span className="text-[10px] font-normal">د.ب</span>
                      </span>
                    </div>
                  </div>

                  {/* السيولة النقدية المتاحة حالياً في حساب المشروع */}
                  <div className="bg-white rounded-2xl p-3.5 border border-[#C7B895]/30 shadow-2xs text-right">
                    <span className="text-[11px] font-bold text-[#1D3A30] block">السيولة المتاحة</span>
                    <span className="text-[9px] text-[#1D3A30]/60 block mb-1">الرصيد الفعلي المتوفر</span>
                    <div className="font-mono">
                      <span className="text-lg sm:text-xl font-black text-[#1D3A30] block">
                        {availableLiquidity.toFixed(2)} <span className="text-[10px] font-normal">د.ب</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. زر لإضافة إيراد / مبلغ مسترد لحساب المشروع */}
                <button
                  type="button"
                  onClick={() => setShowAddFundsModal(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] border border-[#C7B895]/40 text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs active:scale-98 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#E8D5A8]" />
                  <span>+ إضافة إيراد / مبلغ مسترد لحساب المشروع</span>
                </button>

                {/* 4. سجل المبالغ المستردة والإيرادات */}
                <div className="bg-white rounded-2xl p-3.5 border border-[#C7B895]/30 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#C7B895]/20 text-xs font-bold text-[#1D3A30]">
                    <span>سجل الإيرادات والمبالغ المستردة ({customProfits.length})</span>
                    <span className="font-mono text-emerald-700">+{reimbursedInflows.toFixed(2)} د.ب</span>
                  </div>

                  {customProfits.length === 0 ? (
                    <div className="py-5 text-center text-xs text-[#1D3A30]/50">
                      لم يتم تسجيل مبالغ مستردة بعد.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                      {customProfits.map((fund) => (
                        <div
                          key={fund.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-[#FAF7F0] border border-[#C7B895]/30 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#1D3A30]">{fund.description}</span>
                              {fund.category && (
                                <span className="text-[9px] bg-[#E8D5A8]/50 text-[#1D3A30] px-1.5 py-0.5 rounded-md font-medium">
                                  {fund.category}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#1D3A30]/60 font-mono">{fund.date || 'اليوم'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-emerald-800">
                              +{Number(fund.amount).toFixed(2)} د.ب
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteFund(fund.id)}
                              className="p-1 text-[#1D3A30]/40 hover:text-rose-600 transition cursor-pointer"
                              title="حذف المبلغ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 4. MODAL FOR ADDING INFLOWS / REIMBURSEMENTS                               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showAddFundsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 0.6 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowAddFundsModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl z-10 text-right space-y-3.5 border border-[#C7B895]/30"
            >
              <div className="flex items-center justify-between border-b border-[#C7B895]/20 pb-2.5">
                <div>
                  <h3 className="text-xs font-black text-[#1D3A30]">تسجيل إيراد / مبلغ مسترد لحساب المشروع</h3>
                  <p className="text-[10px] text-[#1D3A30]/65">تعويض مشتريات شخصية أو إيرادات متفرقة لحساب المشروع</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFundsModal(false)}
                  className="p-1 rounded-lg text-[#1D3A30]/50 hover:text-[#1D3A30] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddFundsSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    المبلغ المودع بالدينار (د.ب) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    placeholder="0.00"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#C7B895]/40 bg-[#FAF7F0] text-sm font-mono font-bold text-[#1D3A30] focus:ring-1 focus:ring-[#1D3A30] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    نوع الإيراد / سبب الإيداع *
                  </label>
                  <select
                    value={fundCategory}
                    onChange={(e) => setFundCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#C7B895]/40 bg-[#FAF7F0] text-xs font-bold text-[#1D3A30] focus:ring-1 focus:ring-[#1D3A30] outline-none"
                  >
                    <option value="استرداد مشتريات شخصية">استرداد مشتريات شخصية (مثل أغراض شخصية من تيمو)</option>
                    <option value="تعويض مصروف للمشروع">تعويض مصروف للمشروع</option>
                    <option value="إيداع مؤقت لحساب المشروع">إيداع مؤقت لحساب المشروع</option>
                    <option value="إيرادات أخرى">إيرادات متفرقة أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    البيان / الوصف التفصيلي *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: استرداد أغراض شخصية من طلبية تيمو..."
                    value={fundDesc}
                    onChange={(e) => setFundDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    تاريخ التحويل
                  </label>
                  <input
                    type="date"
                    value={fundDate}
                    onChange={(e) => setFundDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-mono text-[#1D3A30]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="submit"
                    className="py-2.5 bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] font-bold rounded-xl transition text-xs shadow-xs cursor-pointer active:scale-95"
                  >
                    حفظ في حساب المشروع
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddFundsModal(false)}
                    className="py-2.5 bg-stone-100 text-stone-700 hover:bg-stone-200 font-bold rounded-xl transition text-xs border border-stone-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
