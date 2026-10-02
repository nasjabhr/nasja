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

  // Single Add Profit Modal State
  const [showAddProfitModal, setShowAddProfitModal] = useState(false);
  const [profitAmount, setProfitAmount] = useState('');
  const [profitDesc, setProfitDesc] = useState('');

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

  // 1. Sales calculation: all paid non-cancelled orders + manual profits
  const paidOrders = orders.filter(
    (o: any) => o.paymentStatus === 'تم الدفع' && o.status !== 'ملغي'
  );
  
  const ordersSales = paidOrders.reduce(
    (sum: number, o: any) => sum + (Number(o.total || o.price) || 0),
    0
  );

  const manualProfits = customProfitsList.reduce(
    (sum: number, p: any) => sum + (Number(p.amount) || 0),
    0
  );

  const totalSales = ordersSales + manualProfits;

  // 2. Expenses calculation: all expenses recorded
  const totalExpenses = expensesList.reduce(
    (sum: number, e: any) => sum + (Number(e.amount) || 0),
    0
  );

  // 3. Net Profit
  const netProfit = totalSales - totalExpenses;

  const handleAddProfitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(profitAmount);
    if (isNaN(amt) || amt <= 0 || !profitDesc.trim()) return;

    await addCustomProfit({
      amount: amt,
      description: profitDesc.trim(),
      category: 'أرباح إضافية',
      date: new Date().toISOString().split('T')[0]
    });

    setShowAddProfitModal(false);
    setProfitAmount('');
    setProfitDesc('');
    loadData();
  };

  const handleDeleteProfit = async (id: string) => {
    await deleteCustomProfitPermanently(id);
    loadData();
  };

  return (
    <div className="space-y-3.5 max-w-xl mx-auto w-full select-none text-right font-sans" dir="rtl">
      
      {/* Header bar with title and single add-profit button */}
      <div className="flex items-center justify-between px-1">
        <h1 className="text-base font-black text-[#1D3A30]">الميزانية</h1>
        <button
          type="button"
          onClick={() => setShowAddProfitModal(true)}
          className="py-1.5 px-3 rounded-xl bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] border border-[#C7B895]/40 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#E8D5A8]" />
          <span>إضافة مبلغ</span>
        </button>
      </div>

      {/* Main Budget Card */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-5 sm:p-6 text-center shadow-xs border transition-all ${
          netProfit >= 0
            ? 'bg-[#1D3A30] text-[#FAF7F0] border-[#C7B895]/40'
            : 'bg-rose-950 text-white border-rose-900'
        }`}
      >
        <span className="text-xs font-bold text-[#E8D5A8] tracking-wide block">
          صافي الأرباح
        </span>

        {/* Net Profit Big Number */}
        <div className="flex items-baseline justify-center gap-1.5 my-2.5 font-mono">
          <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            {netProfit >= 0 ? `+${netProfit.toFixed(2)}` : netProfit.toFixed(2)}
          </span>
          <span className="text-sm font-bold text-[#E8D5A8]">د.ب</span>
        </div>

        {/* Sales vs Expenses Grid */}
        <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3.5 border-t border-white/10 text-xs">
          <div className="bg-white/10 p-3 rounded-2xl border border-white/10 text-right">
            <span className="text-[11px] text-[#C7B895] font-bold block mb-1">
              إجمالي المبيعات
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-300 block">
              +{totalSales.toFixed(2)} <span className="text-[10px] font-normal">د.ب</span>
            </span>
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

      {/* Minimal Profit Log (Only if items exist) */}
      {customProfitsList.length > 0 && (
        <div className="bg-white rounded-2xl p-3 border border-[#C7B895]/30 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#1D3A30] pb-1 border-b border-[#C7B895]/20">
            <span>المبالغ المضافة ({customProfitsList.length})</span>
            <span className="font-mono text-emerald-800">+{manualProfits.toFixed(2)} د.ب</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
            {customProfitsList.map((profit) => (
              <div
                key={profit.id}
                className="flex items-center justify-between p-2 rounded-xl bg-[#FAF7F0] border border-[#C7B895]/30 text-xs"
              >
                <div>
                  <span className="font-bold text-[#1D3A30] block">{profit.description}</span>
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

      {/* Modal: Single modal for adding profit */}
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
                <h3 className="text-xs font-black text-[#1D3A30]">إضافة مبلغ جديد</h3>
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
                    البيان *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="بيان المبلغ..."
                    value={profitDesc}
                    onChange={(e) => setProfitDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="submit"
                    className="py-2.5 bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] font-bold rounded-xl transition text-xs shadow-xs cursor-pointer"
                  >
                    حفظ
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
