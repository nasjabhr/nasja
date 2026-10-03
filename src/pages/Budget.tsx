import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, X } from 'lucide-react';
import { 
  getLocalData, 
  syncWithServer, 
  EVENT_DATA_UPDATED, 
  addCustomProfit,
  deleteCustomProfitPermanently 
} from '../lib/dataService';
import { CustomProfit } from '../types';

export default function Budget() {
  const [orders, setOrders] = useState<any[]>([]);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [customProfitsList, setCustomProfitsList] = useState<CustomProfit[]>([]);

  // Single Add Inflow Modal State
  const [showAddProfitModal, setShowAddProfitModal] = useState(false);
  const [profitAmount, setProfitAmount] = useState('');
  const [profitDesc, setProfitDesc] = useState('');
  const [profitCategory, setProfitCategory] = useState('استرداد مشتريات شخصية');
  const [profitDate, setProfitDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = () => {
    const { orders: ords, expenses: expList, customProfits: profs } = getLocalData();
    setOrders(ords || []);
    setExpensesList(expList || []);
    setCustomProfitsList(profs || []);
  };

  useEffect(() => {
    loadData();
    syncWithServer().then(() => loadData());

    const handleUpdate = () => loadData();
    window.addEventListener(EVENT_DATA_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENT_DATA_UPDATED, handleUpdate);
  }, []);

  // 1. Sales calculation: all paid non-cancelled orders
  const paidOrders = orders.filter(
    (o: any) => o.paymentStatus === 'تم الدفع' && o.status !== 'ملغي'
  );
  
  const ordersSales = paidOrders.reduce(
    (sum: number, o: any) => sum + (Number(o.total || o.price) || 0),
    0
  );

  // 2. Inflows / Reimbursed funds (مبالغ مستردة / إيرادات لحساب المشروع)
  const manualInflows = customProfitsList.reduce(
    (sum: number, p: any) => sum + (Number(p.amount) || 0),
    0
  );

  // Total revenues = sales + reimbursed inflows
  const totalRevenues = ordersSales + manualInflows;

  // 3. Expenses calculation: all expenses recorded
  const totalExpenses = expensesList.reduce(
    (sum: number, e: any) => sum + (Number(e.amount) || 0),
    0
  );

  // 4. Net Operating Flow
  const netFlow = totalRevenues - totalExpenses;

  const handleAddProfitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(profitAmount);
    if (isNaN(amt) || amt <= 0 || !profitDesc.trim()) return;

    await addCustomProfit({
      amount: amt,
      description: profitDesc.trim(),
      category: profitCategory || 'استرداد مشتريات شخصية',
      date: profitDate || new Date().toISOString().split('T')[0]
    });

    setShowAddProfitModal(false);
    setProfitAmount('');
    setProfitDesc('');
    setProfitCategory('استرداد مشتريات شخصية');
    loadData();
  };

  const handleDeleteProfit = async (id: string) => {
    await deleteCustomProfitPermanently(id);
    loadData();
  };

  return (
    <div className="space-y-3.5 max-w-xl mx-auto w-full select-none text-right font-sans" dir="rtl">
      
      {/* Header bar with title and single add button */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-base font-black text-[#1D3A30]">الإيرادات والمستردات</h1>
          <p className="text-[11px] text-[#1D3A30]/60">متابعة تدفقات المتجر والمبالغ المستردة لحساب المشروع</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddProfitModal(true)}
          className="py-1.5 px-3 rounded-xl bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] border border-[#C7B895]/40 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#E8D5A8]" />
          <span>إضافة إيراد / مسترد</span>
        </button>
      </div>

      {/* Main Budget Card */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-5 sm:p-6 text-center shadow-xs border transition-all ${
          netFlow >= 0
            ? 'bg-[#1D3A30] text-[#FAF7F0] border-[#C7B895]/40'
            : 'bg-rose-950 text-white border-rose-900'
        }`}
      >
        <span className="text-xs font-bold text-[#E8D5A8] tracking-wide block">
          صافي حركة الحساب التشغيلية
        </span>

        {/* Big Number */}
        <div className="flex items-baseline justify-center gap-1.5 my-2.5 font-mono">
          <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            {netFlow >= 0 ? `+${netFlow.toFixed(2)}` : netFlow.toFixed(2)}
          </span>
          <span className="text-sm font-bold text-[#E8D5A8]">د.ب</span>
        </div>

        {/* Revenues vs Expenses Grid */}
        <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3.5 border-t border-white/10 text-xs">
          <div className="bg-white/10 p-3 rounded-2xl border border-white/10 text-right">
            <span className="text-[11px] text-[#C7B895] font-bold block mb-1">
              إجمالي الإيرادات والمستردات
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-300 block">
              +{totalRevenues.toFixed(2)} <span className="text-[10px] font-normal">د.ب</span>
            </span>
            {manualInflows > 0 && (
              <span className="text-[10px] text-white/70 block mt-0.5">
                مبيعات: {ordersSales.toFixed(2)} | مستردات: +{manualInflows.toFixed(2)}
              </span>
            )}
          </div>

          <div className="bg-white/10 p-3 rounded-2xl border border-white/10 text-right">
            <span className="text-[11px] text-rose-300 font-bold block mb-1">
              إجمالي المصروفات
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-rose-300 block">
              -{totalExpenses.toFixed(2)} <span className="text-[10px] font-normal">د.ب</span>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Reimbursed Inflows Log */}
      {customProfitsList.length > 0 && (
        <div className="bg-white rounded-2xl p-3 border border-[#C7B895]/30 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#1D3A30] pb-1 border-b border-[#C7B895]/20">
            <span>سجل الإيرادات والمبالغ المستردة ({customProfitsList.length})</span>
            <span className="font-mono text-emerald-800">+{manualInflows.toFixed(2)} د.ب</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
            {customProfitsList.map((profit) => (
              <div
                key={profit.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F0] border border-[#C7B895]/30 text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-bold text-[#1D3A30]">{profit.description}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                      {profit.category || 'مسترد مشتريات'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#1D3A30]/60 font-mono">{profit.date || 'اليوم'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-emerald-800">
                    +{Number(profit.amount).toFixed(2)} د.ب
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteProfit(profit.id)}
                    className="p-1 text-[#1D3A30]/40 hover:text-rose-600 transition cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Single modal for adding inflow */}
      <AnimatePresence>
        {showAddProfitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 0.6 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowAddProfitModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl z-10 text-right space-y-3.5 border border-[#C7B895]/30"
            >
              <div className="flex items-center justify-between border-b border-[#C7B895]/20 pb-2.5">
                <div>
                  <h3 className="text-xs font-black text-[#1D3A30]">إضافة إيراد / مبلغ مسترد لحساب المشروع</h3>
                  <p className="text-[10px] text-[#1D3A30]/60">لا يغيّر رأس المال الأساسي، بل يُحسب كتدفق نقدي داخل</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddProfitModal(false)}
                  className="p-1 rounded-lg text-[#1D3A30]/50 hover:text-[#1D3A30] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddProfitSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    المبلغ بالدينار (د.ب) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    placeholder="0.00"
                    value={profitAmount}
                    onChange={(e) => setProfitAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#C7B895]/40 bg-[#FAF7F0] text-sm font-mono font-bold text-[#1D3A30] focus:ring-1 focus:ring-[#1D3A30] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    نوع الإيراد / سبب الإيداع *
                  </label>
                  <select
                    value={profitCategory}
                    onChange={(e) => setProfitCategory(e.target.value)}
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
                    value={profitDesc}
                    onChange={(e) => setProfitDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    تاريخ التحويل
                  </label>
                  <input
                    type="date"
                    value={profitDate}
                    onChange={(e) => setProfitDate(e.target.value)}
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
                    onClick={() => setShowAddProfitModal(false)}
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
