import React, { useState, useEffect, useRef } from 'react';
import { Fabric, CRITICAL_FABRIC_THRESHOLD, SourcingType } from '../types';
import { Plus, AlertCircle, Image as ImageIcon, Upload, Trash2, Edit3, Search, X, BookOpen, Package, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { persistInventory, deleteFabricPermanently, getLocalData, syncWithServer, EVENT_DATA_UPDATED } from '../lib/dataService';

export default function Inventory() {
  const [inventory, setInventory] = useState<Fabric[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingItem, setEditingItem] = useState<Fabric | null>(null);
  const [fabricToDelete, setFabricToDelete] = useState<Fabric | null>(null);
  const [fabricStructure, setFabricStructure] = useState<'single' | 'set'>('single');
  const [setCount, setSetCount] = useState<number>(4);
  const [newFabric, setNewFabric] = useState<{
    name: string;
    quantity: number | string;
    price: number | string;
    imageUrl: string;
    season?: string;
    description?: string;
    sourcingType?: SourcingType;
    supplierName?: string;
    catalogCode?: string;
    costPrice?: number | string;
  }>({
    name: '',
    quantity: 22.5,
    price: '',
    imageUrl: '',
    season: 'ربيعي',
    description: '',
    sourcingType: 'catalog',
    supplierName: '',
    catalogCode: '',
    costPrice: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'أقمشة' | 'تغليف'>('أقمشة');
  const [sourcingFilter, setSourcingFilter] = useState<'all' | 'catalog' | 'stock'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const local = getLocalData();
    setInventory(local.inventory);

    syncWithServer().then((latest) => {
      setInventory(latest.inventory);
    });

    const handleUpdate = () => {
      const current = getLocalData();
      setInventory(current.inventory);
    };

    window.addEventListener(EVENT_DATA_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENT_DATA_UPDATED, handleUpdate);
  }, []);

  const saveInventory = (updated: Fabric[]) => {
    setInventory(updated);
    persistInventory(updated);
  };

  const confirmDeleteFabric = async () => {
    if (!fabricToDelete) return;
    const fabricId = fabricToDelete.id;
    setFabricToDelete(null);
    const updated = await deleteFabricPermanently(fabricId);
    setInventory(updated);
  };

  const handleDeleteAllFabrics = () => {
    if (inventory.length === 0) return;
    saveInventory([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Compress high-res mobile photos to max 600px
          const canvas = document.createElement('canvas');
          const maxDim = 600;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
            setNewFabric(prev => ({ ...prev, imageUrl: compressedDataUrl }));
          } else {
            setNewFabric(prev => ({ ...prev, imageUrl: event.target?.result as string }));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setEditingItem(null);
    setFabricStructure('single');
    setSetCount(4);
    setNewFabric({
      name: '',
      quantity: activeTab === 'أقمشة' ? 22.5 : 10,
      price: '',
      imageUrl: '',
      season: 'ربيعي',
      description: '',
      sourcingType: 'catalog',
      supplierName: '',
      catalogCode: '',
      costPrice: ''
    });
    setShowModal(true);
  };

  const openEditModal = (item: Fabric) => {
    setModalMode('edit');
    setEditingItem(item);
    setFabricStructure('single');
    const itemSourcing = item.sourcingType || (item.supplierName ? 'catalog' : 'stock');
    setNewFabric({
      name: item.name,
      quantity: item.quantity,
      price: item.price || '',
      imageUrl: item.imageUrl || item.image || '',
      season: item.season || 'كافة الفصول',
      description: item.description || '',
      sourcingType: itemSourcing,
      supplierName: item.supplierName || '',
      catalogCode: item.catalogCode || '',
      costPrice: item.costPrice || ''
    });
    setShowModal(true);
  };

  const handleSaveFabric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFabric.name.trim()) return;
    
    const isFabric = activeTab === 'أقمشة';
    const isCatalog = isFabric && newFabric.sourcingType === 'catalog';

    const qtyNum = parseFloat(String(newFabric.quantity));
    const priceNum = parseFloat(String(newFabric.price));
    const costNum = parseFloat(String(newFabric.costPrice || 0));

    const cleanQty = isCatalog ? 999 : (!isNaN(qtyNum) ? (isFabric ? Math.round(qtyNum * 2) / 2 : Math.round(qtyNum)) : 0);
    const cleanPrice = isFabric ? (!isNaN(priceNum) ? Math.round(priceNum * 1000) / 1000 : 0) : 0;
    const cleanCost = !isNaN(costNum) && costNum >= 0 ? Math.round(costNum * 1000) / 1000 : undefined;

    // If adding a complete set of numbered fabrics
    if (modalMode === 'add' && isFabric && fabricStructure === 'set') {
      const baseName = newFabric.name.trim();
      const count = Math.max(2, setCount);
      const itemsToCreate: Fabric[] = [];
      const timestamp = Date.now();

      for (let i = 1; i <= count; i++) {
        itemsToCreate.push({
          id: `${timestamp}_${i}`,
          name: `${baseName} - ${i}`,
          quantity: cleanQty,
          price: cleanPrice,
          imageUrl: newFabric.imageUrl || undefined,
          category: activeTab,
          season: isFabric ? (newFabric.season || undefined) : undefined,
          description: newFabric.description?.trim() || undefined,
          sourcingType: newFabric.sourcingType || 'catalog',
          supplierName: isCatalog ? (newFabric.supplierName?.trim() || undefined) : undefined,
          catalogCode: isCatalog ? (newFabric.catalogCode ? `${newFabric.catalogCode.trim()} - ${i}` : undefined) : undefined,
          costPrice: cleanCost
        });
      }

      saveInventory([...itemsToCreate, ...inventory]);
      setShowModal(false);
      setEditingItem(null);
      setFabricStructure('single');
      setSetCount(4);
      setNewFabric({
        name: '',
        quantity: 22.5,
        price: '',
        imageUrl: '',
        season: 'ربيعي',
        description: '',
        sourcingType: 'catalog',
        supplierName: '',
        catalogCode: '',
        costPrice: ''
      });
      return;
    }

    const fabricPayload: Partial<Fabric> = {
      name: newFabric.name.trim(),
      quantity: cleanQty,
      price: cleanPrice,
      imageUrl: newFabric.imageUrl || undefined,
      season: isFabric ? (newFabric.season || undefined) : undefined,
      description: newFabric.description?.trim() || undefined,
      sourcingType: isFabric ? (newFabric.sourcingType || 'catalog') : undefined,
      supplierName: isCatalog ? (newFabric.supplierName?.trim() || undefined) : undefined,
      catalogCode: isCatalog ? (newFabric.catalogCode?.trim() || undefined) : undefined,
      costPrice: isCatalog ? cleanCost : undefined
    };

    if (modalMode === 'edit' && editingItem) {
      const updated = inventory.map(item => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            ...fabricPayload
          };
        }
        return item;
      });
      saveInventory(updated);
    } else {
      const fabricItem: Fabric = {
        id: Date.now().toString(),
        name: fabricPayload.name!,
        quantity: fabricPayload.quantity!,
        price: fabricPayload.price!,
        imageUrl: fabricPayload.imageUrl,
        category: activeTab,
        season: fabricPayload.season,
        description: fabricPayload.description,
        sourcingType: fabricPayload.sourcingType,
        supplierName: fabricPayload.supplierName,
        catalogCode: fabricPayload.catalogCode,
        costPrice: fabricPayload.costPrice
      };
      const newInventory = [fabricItem, ...inventory];
      saveInventory(newInventory);
    }

    setShowModal(false);
    setEditingItem(null);
    setFabricStructure('single');
    setSetCount(4);
    setNewFabric({
      name: '',
      quantity: 22.5,
      price: '',
      imageUrl: '',
      season: 'ربيعي',
      description: '',
      sourcingType: 'catalog',
      supplierName: '',
      catalogCode: '',
      costPrice: ''
    });
  };

  const [editingFabricId, setEditingFabricId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>('');

  const handleStartEditingQty = (fabric: Fabric) => {
    setEditingFabricId(fabric.id);
    setEditingQtyValue(String(fabric.quantity));
  };

  const handleFinishEditingQty = (id: string) => {
    if (editingFabricId !== id) return;
    const parsed = parseFloat(editingQtyValue.trim());
    if (!isNaN(parsed) && parsed >= 0) {
      const targetItem = inventory.find(it => it.id === id);
      const isFabric = !targetItem?.category || targetItem.category === 'أقمشة';
      // Strict meter and half meter only
      const clean = isFabric ? Math.round(parsed * 2) / 2 : Math.round(parsed);
      const updated = inventory.map(it => it.id === id ? { ...it, quantity: clean } : it);
      saveInventory(updated);
    }
    setEditingFabricId(null);
    setEditingQtyValue('');
  };

  const handleKeyDownEditingQty = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      handleFinishEditingQty(id);
    } else if (e.key === 'Escape') {
      setEditingFabricId(null);
      setEditingQtyValue('');
    }
  };

  const activeInventory = inventory.filter(item => {
    const itemCategory = item.category || 'أقمشة';
    if (itemCategory !== activeTab) return false;
    if (activeTab === 'أقمشة' && sourcingFilter !== 'all') {
      const isItemCatalog = item.sourcingType === 'catalog' || Boolean(item.supplierName);
      if (sourcingFilter === 'catalog') return isItemCatalog;
      if (sourcingFilter === 'stock') return !isItemCatalog;
    }
    return true;
  });

  const filteredInventory = activeInventory.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.supplierName && item.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.catalogCode && item.catalogCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const fabricsOnly = inventory.filter(f => !f.category || f.category === 'أقمشة');
  const catalogCount = fabricsOnly.filter(f => f.sourcingType === 'catalog' || Boolean(f.supplierName)).length;
  const stockCount = fabricsOnly.filter(f => f.sourcingType !== 'catalog' && !f.supplierName).length;
  const stockMeters = Math.round(fabricsOnly.filter(f => f.sourcingType !== 'catalog' && !f.supplierName).reduce((acc, f) => acc + (Number(f.quantity) || 0), 0) * 10) / 10;
  const packagingTotal = inventory.filter(f => f.category === 'تغليف').reduce((acc, f) => acc + (Number(f.quantity) || 0), 0);

  return (
    <div className="space-y-3.5 pb-6">
      {/* Top Header & Add Button */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-[#C7B895]/30 shadow-xs">
        <div>
          <h1 className="text-base font-extrabold text-[#1D3A30]">المخزون</h1>
          <p className="text-[11px] text-[#1D3A30]/70 font-medium">
            {activeTab === 'أقمشة' 
              ? `${catalogCount} بالطلب من الدفاتر • ${stockCount} بالمخزون الفعلي (${stockMeters} م)`
              : `${activeInventory.length} مواد تغليف • ${packagingTotal} قطعة`}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-atelier px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#E8D5A8]" />
          <span>{activeTab === 'أقمشة' ? 'قماش جديد' : 'مادة جديدة'}</span>
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-1.5 bg-[#FAF7F0] p-1 rounded-2xl border border-[#C7B895]/30">
        <button
          onClick={() => { setActiveTab('أقمشة'); setSourcingFilter('all'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'أقمشة' ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs' : 'text-[#1D3A30]/60 hover:text-[#1D3A30]'
          }`}
        >
          الأقمشة ({fabricsOnly.length})
        </button>
        <button
          onClick={() => setActiveTab('تغليف')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'تغليف' ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs' : 'text-[#1D3A30]/60 hover:text-[#1D3A30]'
          }`}
        >
          مواد التغليف
        </button>
      </div>

      {/* Sub-Filter for Fabrics: All vs Catalog vs Stock */}
      {activeTab === 'أقمشة' && (
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-[#C7B895]/30 text-xs">
          <button
            type="button"
            onClick={() => setSourcingFilter('all')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${
              sourcingFilter === 'all'
                ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs'
                : 'text-[#1D3A30]/70 hover:text-[#1D3A30]'
            }`}
          >
            الكل ({fabricsOnly.length})
          </button>
          <button
            type="button"
            onClick={() => setSourcingFilter('catalog')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition text-center flex items-center justify-center gap-1 cursor-pointer ${
              sourcingFilter === 'catalog'
                ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs'
                : 'text-[#1D3A30]/70 hover:text-[#1D3A30]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#C7B895]" />
            <span>دفاتر الأقمشة ({catalogCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setSourcingFilter('stock')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition text-center flex items-center justify-center gap-1 cursor-pointer ${
              sourcingFilter === 'stock'
                ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs'
                : 'text-[#1D3A30]/70 hover:text-[#1D3A30]'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-[#C7B895]" />
            <span>مخزون فعلي ({stockCount})</span>
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#1D3A30]/40" />
        <input
          type="text"
          placeholder={activeTab === 'أقمشة' ? "بحث بالاسم، اسم المحل، أو كود الدفتر..." : "بحث في مواد التغليف..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white pr-9 pl-8 py-2.5 text-xs rounded-xl border border-[#C7B895]/30 text-[#1D3A30] placeholder-[#1D3A30]/40 focus:outline-none focus:ring-1 focus:ring-[#1D3A30]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#1D3A30]/50 hover:text-[#1D3A30] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Inventory Grid / Feed */}
      {filteredInventory.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-[#C7B895]/30 shadow-xs">
          <div className="w-12 h-12 bg-[#FAF7F0] text-[#1D3A30] rounded-full flex items-center justify-center mx-auto mb-2 border border-[#C7B895]/30">
            <ImageIcon className="w-6 h-6 opacity-60 text-[#A99872]" />
          </div>
          <h3 className="text-sm font-bold text-[#1D3A30]">
            {activeTab === 'أقمشة' ? 'لا توجد أقمشة مسجلة' : 'لا توجد مواد تغليف مسجلة'}
          </h3>
          <p className="text-xs text-[#1D3A30]/60 mt-1">
            {searchQuery 
              ? 'لا توجد نتائج تطابق البحث' 
              : activeTab === 'أقمشة' 
                ? 'ابدأ بإضافة أول صنف من دفتر الأقمشة أو المخزون'
                : 'ابدأ بإضافة أول مادة تغليف لمتابعة المخزون'}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 bg-[#1D3A30] text-[#E8D5A8] text-xs font-bold px-4 py-2.5 rounded-xl border border-[#C7B895]/40 cursor-pointer"
          >
            {activeTab === 'أقمشة' ? '+ إضافة صنف قماش' : '+ إضافة مادة تغليف'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredInventory.map(item => {
            const isFabric = !item.category || item.category === 'أقمشة';
            const isCatalogItem = isFabric && (item.sourcingType === 'catalog' || Boolean(item.supplierName));
            const isLow = !isCatalogItem && (item.category === 'تغليف' ? (Number(item.quantity) || 0) <= 10 : (Number(item.quantity) || 0) < CRITICAL_FABRIC_THRESHOLD);
            const isEditing = editingFabricId === item.id;
            const unitLabel = (item.category === 'تغليف') ? 'قطعة' : 'متر';

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-2xl border transition-all shadow-2xs flex items-center justify-between gap-2.5 ${
                  isLow ? 'bg-[#FAF7F0] border-amber-300/80 ring-1 ring-amber-400/20' : 'bg-white border-[#C7B895]/30 hover:border-[#1D3A30]/30'
                }`}
              >
                {/* Right: Image + Name & Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-[#FAF7F0] flex-shrink-0 overflow-hidden border border-[#C7B895]/30 flex items-center justify-center shadow-2xs">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-[#A99872]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-xs sm:text-sm text-[#1D3A30] truncate">
                        {item.name}
                      </h3>
                      {item.season && (
                        <span className="text-[9px] font-bold text-[#1D3A30] bg-[#FAF7F0] border border-[#C7B895]/50 px-1.5 py-0.5 rounded-md">
                          {item.season.includes('ربيع') ? '🌿 ربيعي' : item.season.includes('شتو') ? '❄️ شتوي' : item.season.includes('صيف') ? '☀️ صيفي' : item.season}
                        </span>
                      )}
                      {isCatalogItem ? (
                        <span className="text-[9px] font-bold text-[#1D3A30] bg-[#FAF7F0] border border-[#C7B895]/50 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <BookOpen className="w-2.5 h-2.5 text-[#C7B895]" />
                          <span>دفتر بالطلب</span>
                        </span>
                      ) : isLow ? (
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded-md">
                          منخفض
                        </span>
                      ) : null}
                    </div>

                    {/* Sourcing details if catalog item */}
                    {isCatalogItem ? (
                      <div className="mt-0.5 space-y-0.5">
                        <p className="text-[10px] text-[#1D3A30]/75">
                          المحل: <span className="font-bold text-[#1D3A30]">{item.supplierName || 'غير محدد'}</span>
                          {item.catalogCode && <> • كود: <span className="font-mono font-bold text-[#1D3A30]">{item.catalogCode}</span></>}
                        </p>
                        <p className="text-[10px] font-mono font-bold text-[#1D3A30]">
                          البيع: <span className="text-[#A99872]">{item.price.toFixed(3)} د.ب</span>
                          {item.costPrice !== undefined && item.costPrice > 0 && (
                            <> • التكلفة: <span className="text-[#1D3A30]/60">{item.costPrice.toFixed(3)} د.ب</span>
                            {' '}• <span className="text-emerald-700">ربح: +{(item.price - item.costPrice).toFixed(3)} د.ب</span>
                            </>
                          )}
                        </p>
                      </div>
                    ) : (
                      item.category !== 'تغليف' && (
                        <p className="text-[11px] font-bold text-[#A99872] font-mono mt-0.5">
                          {item.price.toFixed(3)} د.ب <span className="text-[9px] font-normal text-[#1D3A30]/60">/ {unitLabel}</span>
                        </p>
                      )
                    )}

                    {item.description && (
                      <p className="text-[10px] text-[#1D3A30]/60 truncate mt-0.5 max-w-[140px] sm:max-w-[220px]">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Left: Quantity / Availability Badge + Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isCatalogItem ? (
                    <div className="px-2 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                      <span>متوفر بالطلب</span>
                    </div>
                  ) : isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={unitLabel === 'متر' ? '0.1' : '1'}
                        min="0"
                        autoFocus
                        value={editingQtyValue}
                        onChange={(e) => setEditingQtyValue(e.target.value)}
                        onBlur={() => handleFinishEditingQty(item.id)}
                        onKeyDown={(e) => handleKeyDownEditingQty(e, item.id)}
                        className="w-14 bg-white border border-[#1D3A30] rounded-xl px-1.5 py-1 text-xs font-bold font-mono text-center text-[#1D3A30] focus:outline-none"
                      />
                      <span className="text-[10px] font-bold text-[#1D3A30]">{unitLabel}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartEditingQty(item)}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                        isLow 
                          ? 'bg-amber-50 text-amber-900 border-amber-300' 
                          : 'bg-[#FAF7F0] text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#F2ECE0]'
                      }`}
                      title="تعديل الكمية"
                    >
                      <span className="text-xs font-black">{item.quantity}</span>
                      <span className="text-[10px] font-sans font-medium text-[#1D3A30]/70">{unitLabel}</span>
                    </button>
                  )}

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditModal(item);
                    }}
                    className="w-8 h-8 rounded-xl bg-[#FAF7F0] hover:bg-[#F2ECE0] text-[#A99872] hover:text-[#1D3A30] border border-[#C7B895]/30 flex items-center justify-center transition cursor-pointer active:scale-95 shadow-2xs"
                    title="تعديل"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFabricToDelete(item);
                    }}
                    className="w-8 h-8 rounded-xl bg-[#FAF7F0] hover:bg-rose-50 text-[#1D3A30]/40 hover:text-rose-600 border border-[#C7B895]/30 hover:border-rose-200 flex items-center justify-center transition cursor-pointer active:scale-95 shadow-2xs"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Fabric / Packaging Modal */}
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
                    {modalMode === 'edit'
                      ? (activeTab === 'أقمشة' ? 'تعديل بيانات القماش' : 'تعديل بيانات مادة التغليف')
                      : (activeTab === 'أقمشة' ? 'إضافة صنف قماش جديد' : 'إضافة مادة تغليف جديدة')}
                  </h3>
                  <p className="text-[10px] text-[#E8D5A8]">
                    {activeTab === 'أقمشة' 
                      ? 'يمكنك إضافة قماش بالطلب من دفتر محل، أو مخزون فعلي بالأمتار'
                      : 'تحديد الكمية المتوفرة بالعدد/القطع (أكياس، علب، شرائط)'}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg bg-white/10 text-[#E8D5A8] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveFabric} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs no-scrollbar">
                
                {/* Fabric Sourcing Mode Toggle (Only for fabrics) */}
                {activeTab === 'أقمشة' && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1.5">
                      نوع وطريقة توفير القماش *
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF7F0] rounded-xl border border-[#C7B895]/40">
                      <button
                        type="button"
                        onClick={() => setNewFabric({ ...newFabric, sourcingType: 'catalog' })}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          newFabric.sourcingType === 'catalog'
                            ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs'
                            : 'text-[#1D3A30]/70 hover:text-[#1D3A30]'
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>دفتر قماش (بالطلب من المحل)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewFabric({ ...newFabric, sourcingType: 'stock' })}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          newFabric.sourcingType === 'stock'
                            ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs'
                            : 'text-[#1D3A30]/70 hover:text-[#1D3A30]'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>مخزون فعلي (بالأمتار)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Fabric Structure: Single Fabric or Complete Numbered Set */}
                {activeTab === 'أقمشة' && modalMode === 'add' && (
                  <div className="space-y-2 p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-[#1D3A30]">
                        نوع وتنسيق القماش *
                      </label>
                      <span className="text-[10px] text-[#A99872] font-semibold">مفرد أو مجموعة مرقمة</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFabricStructure('single')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          fabricStructure === 'single'
                            ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs'
                            : 'bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]'
                        }`}
                      >
                        <span>قماش مفرد لوحده</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFabricStructure('set')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          fabricStructure === 'set'
                            ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs'
                            : 'bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]'
                        }`}
                      >
                        <span>مجموعة كاملة مرقمة ✨</span>
                      </button>
                    </div>

                    {fabricStructure === 'set' && (
                      <div className="pt-2 border-t border-[#C7B895]/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#1D3A30]">عدد الأقمشة داخل المجموعة:</span>
                          <div className="flex items-center gap-1">
                            {[2, 3, 4, 5, 6, 8, 10].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setSetCount(num)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                                  setCount === num
                                    ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30]'
                                    : 'bg-white text-[#1D3A30] border-[#C7B895]/30'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="2"
                            max="30"
                            required
                            value={setCount}
                            onChange={(e) => setSetCount(Math.max(2, parseInt(e.target.value) || 2))}
                            className="w-16 p-1.5 rounded-xl border border-[#C7B895]/40 bg-white font-bold font-mono text-xs text-center text-[#1D3A30]"
                          />
                          <span className="text-[11px] text-[#1D3A30]/80">
                            أقمشة تترتب تلقائياً بأرقام من 1 إلى {setCount}
                          </span>
                        </div>

                        <p className="text-[10px] text-[#A99872] font-semibold bg-white p-2 rounded-xl border border-[#C7B895]/20">
                          💡 سيتم تلقائياً إنشاء الأقمشة: {newFabric.name ? `${newFabric.name.trim()} - 1` : 'المجموعة - 1'} إلى {newFabric.name ? `${newFabric.name.trim()} - ${setCount}` : `المجموعة - ${setCount}`}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    {fabricStructure === 'set' && activeTab === 'أقمشة' && modalMode === 'add'
                      ? 'اسم المجموعة الأساسي (مثال: برج العرب) *'
                      : (activeTab === 'أقمشة' ? 'اسم القماش *' : 'اسم مادة التغليف *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={fabricStructure === 'set' && activeTab === 'أقمشة' && modalMode === 'add' ? 'مثال: برج العرب' : (activeTab === 'أقمشة' ? 'مثال: قطن كوري، ياباني واقف...' : 'مثال: أكياس ورقية، علب هدايا، كروت إهداء...')}
                    value={newFabric.name}
                    onChange={(e) => setNewFabric({ ...newFabric, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                  />
                </div>

                {activeTab === 'أقمشة' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-[#1D3A30]">
                        تصنيف الموسم / الفصل *
                      </label>
                      <span className="text-[10px] text-[#A99872] font-semibold">يحدد ظهوره في أقسام المتجر</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'ربيعي', label: 'ربيعي 🌿' },
                        { id: 'شتوي', label: 'شتوي ❄️' },
                        { id: 'صيفي', label: 'صيفي ☀️' },
                        { id: 'كافة الفصول', label: 'كافة الفصول ✨' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setNewFabric({ ...newFabric, season: s.id })}
                          className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                            (newFabric.season || 'كافة الفصول') === s.id
                              ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs'
                              : 'bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sourcing Details (When Catalog Sourcing) */}
                {activeTab === 'أقمشة' && newFabric.sourcingType === 'catalog' ? (
                  <div className="space-y-2.5 p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/40">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#1D3A30]">
                      <span>بيانات المحل والشراء (لتوفيره فور وصول أي طلب)</span>
                      <span className="text-[10px] text-[#A99872]">خاص بك ولا يظهر للزبون</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-[#1D3A30] mb-1">
                          اسم المحل أو المورد *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: محل كاكولي، الخواجة..."
                          value={newFabric.supplierName || ''}
                          onChange={(e) => setNewFabric({ ...newFabric, supplierName: e.target.value })}
                          className="w-full p-2 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] bg-white text-xs text-[#1D3A30]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#1D3A30] mb-1">
                          رقم أو كود العينة في الدفتر *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: دفتر 2 - عينة 14"
                          value={newFabric.catalogCode || ''}
                          onChange={(e) => setNewFabric({ ...newFabric, catalogCode: e.target.value })}
                          className="w-full p-2 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] bg-white text-xs text-[#1D3A30]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-[#1D3A30] mb-1">
                          سعر الشراء من المحل (التكلفة د.ب)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={newFabric.costPrice}
                          onChange={(e) => setNewFabric({ ...newFabric, costPrice: e.target.value })}
                          className="w-full p-2 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] bg-white text-xs font-bold font-mono text-[#1D3A30]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#1D3A30] mb-1">
                          سعر البيع للزبون (د.ب للمتر) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          placeholder="0.00"
                          value={newFabric.price}
                          onChange={(e) => setNewFabric({ ...newFabric, price: e.target.value })}
                          className="w-full p-2 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] bg-white text-xs font-bold font-mono text-[#1D3A30]"
                        />
                      </div>
                    </div>

                    {/* Live Profit Margin Calculator */}
                    {Number(newFabric.price) > 0 && Number(newFabric.costPrice) > 0 && (
                      <div className="p-2 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs font-bold">
                        <span className="text-emerald-800">صافي ربحك في المتر:</span>
                        <span className="font-mono text-emerald-700">
                          +{(Number(newFabric.price) - Number(newFabric.costPrice)).toFixed(3)} د.ب
                        </span>
                      </div>
                    )}
                  </div>
                ) : activeTab === 'أقمشة' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                        الكمية المتوفرة بالمتر *
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        required
                        min="0"
                        placeholder="مثال: 22.5"
                        value={newFabric.quantity}
                        onChange={(e) => setNewFabric({ ...newFabric, quantity: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-bold font-mono text-[#1D3A30]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                        السعر للمتر (د.ب) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="0.00"
                        value={newFabric.price}
                        onChange={(e) => setNewFabric({ ...newFabric, price: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-bold font-mono text-[#1D3A30]"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                      الكمية المتوفرة بالعدد / القطعة *
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      min="0"
                      placeholder="مثال: 50 قطعة"
                      value={newFabric.quantity}
                      onChange={(e) => setNewFabric({ ...newFabric, quantity: e.target.value, price: 0 })}
                      className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-bold font-mono text-[#1D3A30]"
                    />
                  </div>
                )}

                {/* Additional Info */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1 flex items-center justify-between">
                    <span>{activeTab === 'أقمشة' ? 'مواصفات وملاحظات القماش (اختياري)' : 'ملاحظات إضافية (اختياري)'}</span>
                    <span className="text-[10px] text-[#A99872]">تظهر في تفاصيل القماش بالمتجر</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder={activeTab === 'أقمشة' ? 'مثال: قماش صيفي خفيف، ناعم ومريح وبارد...' : 'مواصفات أو مقاسات إضافية...'}
                    value={newFabric.description || ''}
                    onChange={(e) => setNewFabric({ ...newFabric, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30] resize-none placeholder:text-[#1D3A30]/35"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    {activeTab === 'أقمشة' ? 'صورة القماش (اختياري)' : 'صورة مادة التغليف (اختياري)'}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  
                  {newFabric.imageUrl ? (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-[#C7B895]/40">
                      <img src={newFabric.imageUrl} alt="معاينة" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewFabric({ ...newFabric, imageUrl: '' })}
                        className="absolute top-2 left-2 bg-rose-600 text-white p-1 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-[#C7B895]/40 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-[#FAF7F0] transition text-[#1D3A30] cursor-pointer"
                    >
                      <Upload className="w-5 h-5 opacity-60 text-[#A99872]" />
                      <span className="text-[11px] font-medium">التقاط أو اختيار صورة من الهاتف</span>
                    </button>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="btn-primary-atelier w-full py-3 text-xs font-black rounded-xl transition-all active:scale-98 shadow-sm cursor-pointer"
                  >
                    {modalMode === 'edit'
                      ? 'حفظ التعديلات'
                      : (activeTab === 'أقمشة' ? 'حفظ القماش في المخزون' : 'حفظ مادة التغليف في المخزون')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {fabricToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setFabricToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl z-10 text-center space-y-4 border border-[#C7B895]/30"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#1D3A30]">
                  {fabricToDelete.category === 'تغليف' ? 'تأكيد حذف مادة التغليف' : 'تأكيد حذف القماش'}
                </h3>
                <p className="text-xs text-[#1D3A30]/70 mt-1">
                  هل أنت متأكد من حذف <strong className="text-[#1D3A30] font-bold">"{fabricToDelete.name}"</strong> نهائياً من المخزون؟
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFabricToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteFabric}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-sm"
                >
                  نعم، احذف نهائياً
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
