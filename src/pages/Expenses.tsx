import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Receipt, DollarSign, Tag, Edit3, Clock, Calendar, 
  Search, Filter, AlertTriangle, X, CreditCard, UserCheck, RefreshCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, PaymentMethod } from '../types';
import { formatDateTime, toDatetimeLocal, fromDatetimeLocal } from '../lib/dateUtils';
import { persistExpenses, deleteExpensePermanently, getLocalData, syncWithServer, EVENT_DATA_UPDATED } from '../lib/dataService';

const EXPENSE_CATEGORIES = [
  'أقمشة ومستلزمات المخزون',
  'شحن وتوصيل',
  'تغليف ومطبوعات',
  'تسويق وإعلانات',
  'صيانة وأدوات',
  'عام ومصاريف أخرى'
];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Deletion modal state
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Filter & search states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'month'>('all');

  // Form state
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'أقمشة ومستلزمات المخزون',
    paymentMethod: 'بنفت بي' as PaymentMethod,
    paidTo: '',
    datetimeStr: toDatetimeLocal(),
    notes: ''
  });

  useEffect(() => {
    const local = getLocalData();
    setExpenses(local.expenses);

    syncWithServer().then((latest) => {
      setExpenses(latest.expenses);
    });

    const handleUpdate = () => {
      const current = getLocalData();
      setExpenses(current.expenses);
    };

    window.addEventListener(EVENT_DATA_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENT_DATA_UPDATED, handleUpdate);
  }, []);

  const saveExpenses = (updated: Expense[]) => {
    setExpenses(updated);
    persistExpenses(updated);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingExpenseId(null);
    setExpenseForm({
      description: '',
      amount: '',
      category: 'أقمشة ومستلزمات المخزون',
      paymentMethod: 'بنفت بي',
      paidTo: '',
      datetimeStr: toDatetimeLocal(),
      notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (expense: Expense) => {
    setModalMode('edit');
    setEditingExpenseId(expense.id);
    setExpenseForm({
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category || 'عام ومصاريف أخرى',
      paymentMethod: (expense.paymentMethod as PaymentMethod) || 'بنفت بي',
      paidTo: expense.paidTo || '',
      datetimeStr: toDatetimeLocal(expense.createdAt),
      notes: expense.notes || ''
    });
    setShowModal(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount) return;

    const amountNum = parseFloat(expenseForm.amount);
    const createdAtMs = fromDatetimeLocal(expenseForm.datetimeStr);

    if (modalMode === 'edit' && editingExpenseId) {
      // Edit existing expense
      const updated = expenses.map(exp => {
        if (exp.id === editingExpenseId) {
          return {
            ...exp,
            description: expenseForm.description.trim(),
            amount: amountNum,
            category: expenseForm.category,
            paymentMethod: expenseForm.paymentMethod,
            paidTo: expenseForm.paidTo.trim(),
            notes: expenseForm.notes.trim(),
            createdAt: createdAtMs
          };
        }
        return exp;
      });
      saveExpenses(updated);
    } else {
      // Create new expense
      const newExp: Expense = {
        id: Math.random().toString(36).substring(2, 8).toUpperCase(),
        description: expenseForm.description.trim(),
        amount: amountNum,
        category: expenseForm.category,
        paymentMethod: expenseForm.paymentMethod,
        paidTo: expenseForm.paidTo.trim(),
        notes: expenseForm.notes.trim(),
        createdAt: createdAtMs
      };
      saveExpenses([newExp, ...expenses]);
    }

    setShowModal(false);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    const expenseId = expenseToDelete.id;
    setExpenseToDelete(null);
    const updated = await deleteExpensePermanently(expenseId);
    setExpenses(updated);
  };

  // Filter logic
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const filteredExpenses = expenses.filter(exp => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      exp.description?.toLowerCase().includes(q) ||
      exp.category?.toLowerCase().includes(q) ||
      exp.paidTo?.toLowerCase().includes(q) ||
      exp.id?.toLowerCase().includes(q) ||
      (exp.notes && exp.notes.toLowerCase().includes(q))
    );
    if (!matchesSearch) return false;

    if (categoryFilter !== 'all' && exp.category !== categoryFilter) {
      return false;
    }

    if (timeFilter === 'today' && exp.createdAt < startOfToday) {
      return false;
    }
    if (timeFilter === 'month' && exp.createdAt < startOfMonth) {
      return false;
    }

    return true;
  });

  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-3.5 pb-6">
      {/* Top Header & Add Button */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-[#C7B895]/30 shadow-xs">
        <div>
          <h1 className="text-base font-extrabold text-[#1D3A30]">المصروفات</h1>
          <p className="text-[11px] text-[#1D3A30]/70 font-medium">
            {expenses.length} مصروف • <span className="font-bold text-rose-700 font-mono">{totalAmount.toFixed(3)} د.ب</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              try {
                const latest = await syncWithServer();
                setExpenses(latest.expenses);
              } finally {
                setTimeout(() => setIsRefreshing(false), 500);
              }
            }}
            title="مزامنة فورية وتحديث البيانات"
            className="p-2 rounded-xl bg-[#FAF7F0] border border-[#C7B895]/30 text-[#1D3A30] hover:bg-[#E8D5A8]/40 transition active:scale-95 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 text-[#1D3A30] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="btn-primary-atelier px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#E8D5A8]" />
            <span>مصروف جديد</span>
          </button>
        </div>
      </div>

      {/* Mobile Search & Filter Chips */}
      <div className="space-y-2">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#1D3A30]/40" />
          <input
            type="text"
            placeholder="بحث بوصف المصروف، التصنيف، أو المدفوع له..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white pr-9 pl-8 py-2.5 text-xs rounded-xl border border-[#C7B895]/30 text-[#1D3A30] placeholder-[#1D3A30]/40 focus:outline-none focus:ring-1 focus:ring-[#1D3A30]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#1D3A30]/50 hover:text-[#1D3A30]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Categories Horizontal Scroll Chips (no scrollbar) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
              categoryFilter === 'all'
                ? 'bg-[#1D3A30] text-[#FAF7F0] shadow-xs border border-[#1D3A30]'
                : 'bg-white text-[#1D3A30]/70 border border-[#C7B895]/30 hover:border-[#C7B895]'
            }`}
          >
            الكل ({expenses.length})
          </button>
          
          {EXPENSE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                categoryFilter === cat
                  ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs border border-[#C7B895]'
                  : 'bg-white text-[#1D3A30]/70 border border-[#C7B895]/30 hover:border-[#C7B895]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Mobile Cards Feed */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-[#C7B895]/30 shadow-xs">
          <div className="w-12 h-12 bg-[#FAF7F0] text-[#1D3A30] rounded-full flex items-center justify-center mx-auto mb-2 border border-[#C7B895]/30">
            <Receipt className="w-6 h-6 text-[#A99872]" />
          </div>
          <h3 className="text-sm font-bold text-[#1D3A30]">لا توجد مصروفات مسجلة</h3>
          <p className="text-xs text-[#1D3A30]/60 mt-1">سجل نفقات المتجر لحساب الأرباح بدقة</p>
          <button
            onClick={openCreateModal}
            className="mt-4 bg-[#1D3A30] text-[#E8D5A8] text-xs font-bold px-4 py-2.5 rounded-xl border border-[#C7B895]/30"
          >
            + تسجيل مصروف جديد الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredExpenses.map((exp) => {
            const { full, isToday } = formatDateTime(exp.createdAt);

            return (
              <motion.div
                key={exp.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-3.5 border border-[#C7B895]/30 shadow-xs hover:border-[#C7B895] transition"
              >
                {/* Header: Category Badge + Amount */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#C7B895]/20">
                  <span className="text-[10px] font-bold bg-[#FAF7F0] text-[#1D3A30] px-2.5 py-0.5 rounded-full border border-[#C7B895]/30">
                    {exp.category || 'عام ومصاريف أخرى'}
                  </span>
                  
                  <span className="text-sm font-black text-rose-700 font-mono">
                    -{Number(exp.amount).toFixed(3)}{' '}
                    <span className="text-[10px] font-bold">د.ب</span>
                  </span>
                </div>

                {/* Body: Description, Paid To & Notes */}
                <div className="py-2.5">
                  <h3 className="text-xs font-bold text-[#1D3A30] leading-snug">
                    {exp.description}
                  </h3>

                  {exp.paidTo && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#1D3A30]/80 mt-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-[#A99872]" />
                      <span>المدفوع له: <strong className="text-[#1D3A30]">{exp.paidTo}</strong></span>
                    </div>
                  )}

                  {exp.notes && (
                    <p className="text-[10px] bg-[#FAF7F0] text-[#1D3A30]/80 p-2 rounded-xl mt-2 border border-[#C7B895]/20">
                      ملاحظة: {exp.notes}
                    </p>
                  )}
                </div>

                {/* Footer: Date & Time, Payment Method, Actions */}
                <div className="pt-2 border-t border-[#C7B895]/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#1D3A30]/60 font-mono">
                    <span className="bg-[#FAF7F0] px-2 py-0.5 rounded-md text-[#1D3A30] font-medium border border-[#C7B895]/20">
                      {exp.paymentMethod || 'بنفت بي'}
                    </span>
                    <span>•</span>
                    <span className={isToday ? "font-bold text-[#1D3A30]" : ""}>
                      {full}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(exp)}
                      className="p-1.5 text-[#1D3A30]/70 hover:text-[#1D3A30] hover:bg-[#FAF7F0] rounded-lg transition"
                      title="تعديل تفاصيل المصروف"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setExpenseToDelete(exp)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="حذف المصروف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal (Mobile Bottom Sheet) */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[90dvh] flex flex-col overflow-hidden border border-[#C7B895]/30"
            >
              <div className="p-4 border-b border-[#C7B895]/30 flex justify-between items-center bg-[#1D3A30] text-[#FAF7F0]">
                <div>
                  <h3 className="text-sm font-bold text-[#FAF7F0]">
                    {modalMode === 'edit' ? 'تعديل بيانات المصروف' : 'تسجيل مصروف جديد'}
                  </h3>
                  <p className="text-[10px] text-[#E8D5A8]">
                    {modalMode === 'edit' ? 'تصحيح الأخطاء أو تعديل التوقيت' : 'سجل نفقات وتشغيل المتجر'}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg bg-white/10 text-[#E8D5A8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveExpense} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs no-scrollbar">
                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    بيان / وصف المصروف *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: شراء لفافات أقمشة قطن، فاتورة كهرباء المتجر..."
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                      المبلغ (د.ب) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-bold font-mono text-[#1D3A30]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                      المدفوع له (المورد / الجهة)
                    </label>
                    <input
                      type="text"
                      placeholder="اسم المحل أو الشخص"
                      value={expenseForm.paidTo}
                      onChange={(e) => setExpenseForm({ ...expenseForm, paidTo: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                      التصنيف
                    </label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs bg-white text-[#1D3A30]"
                    >
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                      طريقة الدفع
                    </label>
                    <select
                      value={expenseForm.paymentMethod}
                      onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as PaymentMethod })}
                      className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs bg-white text-[#1D3A30]"
                    >
                      <option value="بنفت بي">بنفت بي (BenefitPay)</option>
                      <option value="نقداً">نقداً (Cash)</option>
                      <option value="بطاقة ائتمانية">بطاقة ائتمانية</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>
                </div>

                {/* Date & Time Picker */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    تاريخ ووقت الصرف (بالدقيقة والساعة)
                  </label>
                  <input
                    type="datetime-local"
                    value={expenseForm.datetimeStr}
                    onChange={(e) => setExpenseForm({ ...expenseForm, datetimeStr: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-mono text-[#1D3A30]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    ملاحظات أو رقم السند
                  </label>
                  <input
                    type="text"
                    placeholder="رقم الفاتورة الورقية أو السند..."
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="btn-primary-atelier w-full py-3 text-xs font-black rounded-xl transition-all active:scale-98 shadow-sm cursor-pointer"
                  >
                    {modalMode === 'edit' ? 'حفظ التعديلات' : 'تسجيل المصروف'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {expenseToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpenseToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl z-10 text-center space-y-3 border border-[#C7B895]/30"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#1D3A30]">تأكيد حذف المصروف</h3>
              <p className="text-xs text-[#1D3A30]/70">
                هل أنت متأكد من حذف مصروف "{expenseToDelete.description}" بقيمة {expenseToDelete.amount} د.ب من السجلات؟
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={confirmDeleteExpense}
                  className="py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition"
                >
                  نعم، احذف المصروف
                </button>
                <button
                  onClick={() => setExpenseToDelete(null)}
                  className="py-2.5 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200 transition border border-stone-200"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
