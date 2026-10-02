import React, { useState, useEffect } from 'react';
import { 
  Plus, FileText, Phone, Trash2, CheckCircle2, Clock, Search, 
  MessageSquare, Eye, X, Printer, Download, Edit3, Calendar, 
  CreditCard, AlertTriangle, Filter, RotateCcw, ChevronDown,
  Ruler, Layers, Minus, Sparkles, Check, Truck, User, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Fabric, Order, OrderStatus, PaymentMethod, PaymentStatus, DeliveryType, DeliveryZone, isOrderPaid, BahrainGovernorateName, BAHRAIN_GOVERNORATES } from '../types';
import { formatDateTime, toDatetimeLocal, fromDatetimeLocal } from '../lib/dateUtils';
import NasjahLogo from '../components/NasjahLogo';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { 
  persistOrders, 
  deleteOrderPermanently, 
  persistInventory,
  getLocalData, 
  syncWithServer, 
  EVENT_DATA_UPDATED 
} from '../lib/dataService';
import { cn } from '../lib/utils';

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const availableFabrics = fabrics.filter(f => !f.category || f.category === 'أقمشة');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  // Fabric selection in modal
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [selectedMeters, setSelectedMeters] = useState<number>(1);
  const [metersInputStr, setMetersInputStr] = useState<string>('1');
  const [customFabricMode, setCustomFabricMode] = useState<boolean>(false);
  const [stockError, setStockError] = useState<string | null>(null);

  // Deletion modal state
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'تم الدفع' | 'قيد الدفع' | 'آجل'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateFilter, setShowDateFilter] = useState<boolean>(false);

  // Selected Invoice for preview
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);
  
  // Form state
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    phone: '',
    details: '',
    price: '',
    status: 'قيد التجهيز' as OrderStatus,
    paymentStatus: 'تم الدفع' as PaymentStatus,
    paymentMethod: 'بنفت بي' as PaymentMethod,
    deliveryType: 'قدوم شخصي' as DeliveryType,
    governorate: 'المحافظة الشمالية' as BahrainGovernorateName,
    area: 'سار',
    deliveryZone: 'المحافظة الشمالية - سار' as DeliveryZone,
    deliveryFee: 0,
    datetimeStr: toDatetimeLocal(),
    notes: ''
  });

  const handleDeliveryTypeChange = (type: DeliveryType) => {
    const gov = (orderForm.governorate as BahrainGovernorateName) || 'المحافظة الشمالية';
    const govFee = BAHRAIN_GOVERNORATES[gov]?.fee ?? 0.50;
    const newFee = type === 'توصيل' ? govFee : 0;
    const oldFee = orderForm.deliveryFee || 0;
    const currentTotal = parseFloat(orderForm.price) || 0;
    const basePrice = Math.max(0, currentTotal - oldFee);
    const updatedTotal = (basePrice + newFee).toFixed(2);

    setOrderForm(prev => ({
      ...prev,
      deliveryType: type,
      deliveryFee: newFee,
      deliveryZone: type === 'توصيل' ? (`${prev.governorate} - ${prev.area}` as DeliveryZone) : ('قريب' as DeliveryZone),
      price: updatedTotal
    }));
  };

  const handleGovernorateChange = (govName: BahrainGovernorateName) => {
    const gov = BAHRAIN_GOVERNORATES[govName];
    const newFee = gov?.fee ?? 0.50;
    const defaultArea = gov?.areas[0] || 'سار';
    const oldFee = orderForm.deliveryFee || 0;
    const currentTotal = parseFloat(orderForm.price) || 0;
    const basePrice = Math.max(0, currentTotal - oldFee);
    const updatedTotal = (basePrice + newFee).toFixed(2);

    setOrderForm(prev => ({
      ...prev,
      governorate: govName,
      area: defaultArea,
      deliveryZone: `${govName} - ${defaultArea}` as DeliveryZone,
      deliveryFee: newFee,
      price: updatedTotal
    }));
  };

  const handleAreaChange = (newArea: string) => {
    setOrderForm(prev => ({
      ...prev,
      area: newArea,
      deliveryZone: `${prev.governorate} - ${newArea}` as DeliveryZone
    }));
  };

  useEffect(() => {
    const local = getLocalData();
    setOrders(local.orders);
    setFabrics(local.inventory);

    syncWithServer().then((latest) => {
      setOrders(latest.orders);
      setFabrics(latest.inventory);
    });

    const handleUpdate = () => {
      const current = getLocalData();
      setOrders(current.orders);
      setFabrics(current.inventory);
    };

    window.addEventListener(EVENT_DATA_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENT_DATA_UPDATED, handleUpdate);
  }, []);

  const saveOrders = (updated: Order[]) => {
    setOrders(updated);
    persistOrders(updated);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingOrderId(null);
    setSelectedFabricId(null);
    setSelectedMeters(1);
    setMetersInputStr('1');
    setCustomFabricMode(false);
    setStockError(null);
    setOrderForm({
      customerName: '',
      phone: '',
      details: '',
      price: '',
      status: 'قيد التجهيز',
      paymentStatus: 'تم الدفع',
      paymentMethod: 'بنفت بي',
      deliveryType: 'قدوم شخصي',
      governorate: 'المحافظة الشمالية',
      area: 'سار',
      deliveryZone: 'المحافظة الشمالية - سار',
      deliveryFee: 0,
      datetimeStr: toDatetimeLocal(),
      notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (order: Order) => {
    setModalMode('edit');
    setEditingOrderId(order.id);
    setStockError(null);

    if (order.fabricId) {
      setSelectedFabricId(order.fabricId);
      const m = order.fabricMeters || 1;
      setSelectedMeters(m);
      setMetersInputStr(String(m));
      setCustomFabricMode(false);
    } else {
      setSelectedFabricId(null);
      setSelectedMeters(1);
      setMetersInputStr('1');
      setCustomFabricMode(true);
    }

    const initialGov = (order.governorate as BahrainGovernorateName) || 
      (order.deliveryZone && order.deliveryZone.includes('محرق') ? 'محافظة المحرق' :
       order.deliveryZone && order.deliveryZone.includes('عاصمة') ? 'محافظة العاصمة' :
       order.deliveryZone && order.deliveryZone.includes('جنوبية') ? 'المحافظة الجنوبية' : 'المحافظة الشمالية');
    const initialArea = order.area || 
      (order.deliveryZone && order.deliveryZone.includes('-') ? order.deliveryZone.split('-')[1]?.trim() : (BAHRAIN_GOVERNORATES[initialGov]?.areas[0] || 'سار'));

    setOrderForm({
      customerName: order.customerName,
      phone: order.phone,
      details: order.details,
      price: String(order.price || order.total || ''),
      status: order.status || 'قيد التجهيز',
      paymentStatus: (order.paymentStatus || 'تم الدفع') as PaymentStatus,
      paymentMethod: (order.paymentMethod as PaymentMethod) || 'بنفت بي',
      deliveryType: (order.deliveryType as DeliveryType) || 'قدوم شخصي',
      governorate: initialGov,
      area: initialArea,
      deliveryZone: order.deliveryZone || `${initialGov} - ${initialArea}`,
      deliveryFee: Number(order.deliveryFee || 0),
      datetimeStr: toDatetimeLocal(order.createdAt),
      notes: order.notes || ''
    });
    setShowModal(true);
  };

  // Handle fabric selection in the horizontal card list
  const handleSelectFabric = (fabric: Fabric) => {
    const isAlreadySelected = selectedFabricId === fabric.id;
    if (isAlreadySelected) {
      setSelectedFabricId(fabric.id);
    } else {
      setSelectedFabricId(fabric.id);
    }
    setCustomFabricMode(false);
    setStockError(null);

    const parsedM = parseFloat(metersInputStr);
    const meters = !isNaN(parsedM) && parsedM > 0 ? parsedM : (selectedMeters > 0 ? selectedMeters : 1);
    const detailsText = `قماش ${fabric.name} (${meters} متر)`;
    
    // Auto-calculate suggested price if fabric has price
    const suggestedPrice = fabric.price > 0 ? (fabric.price * meters).toFixed(2) : orderForm.price;

    setOrderForm(prev => ({
      ...prev,
      details: detailsText,
      price: suggestedPrice || prev.price
    }));

    // Check stock immediately
    if ((Number(fabric.quantity) || 0) <= 0) {
      setStockError(`تنبيه: قماش "${fabric.name}" نفد من المخزون تماماً (0 متر متوفر). لا يمكن إتمام الطلب.`);
    } else if (meters > fabric.quantity) {
      setStockError(`تنبيه: الأمتار المطلوبة (${meters} م) تتجاوز الكمية المتوفرة بالمخزون (${fabric.quantity} م فقط).`);
    }
  };

  // Handle changing meters via stepper (+0.5 / -0.5) or quick chips
  const handleChangeMeters = (newMeters: number) => {
    const cleanMeters = Math.round(Math.max(0.1, newMeters) * 10) / 10;
    setSelectedMeters(cleanMeters);
    setMetersInputStr(String(cleanMeters));

    const fabric = fabrics.find(f => f.id === selectedFabricId);
    if (fabric) {
      const detailsText = `قماش ${fabric.name} (${cleanMeters} متر)`;
      const suggestedPrice = fabric.price > 0 ? (fabric.price * cleanMeters).toFixed(2) : orderForm.price;

      setOrderForm(prev => ({
        ...prev,
        details: detailsText,
        price: suggestedPrice || prev.price
      }));

      // Stock validation
      if ((Number(fabric.quantity) || 0) <= 0) {
        setStockError(`تنبيه: قماش "${fabric.name}" نفد من المخزون تماماً.`);
      } else if (cleanMeters > fabric.quantity) {
        setStockError(`عذراً، الأمتار المطلوبة (${cleanMeters} م) غير متوفرة. المتوفر حالياً بالمخزون هو ${fabric.quantity} متر فقط.`);
      } else {
        setStockError(null);
      }
    }
  };

  // Handle free-form typing of meters (e.g. "22.5", "3.5", "0.5")
  const handleMetersInputChange = (rawVal: string) => {
    setMetersInputStr(rawVal);
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedMeters(parsed);

      const fabric = fabrics.find(f => f.id === selectedFabricId);
      if (fabric) {
        const detailsText = `قماش ${fabric.name} (${parsed} متر)`;
        const suggestedPrice = fabric.price > 0 ? (fabric.price * parsed).toFixed(2) : orderForm.price;

        setOrderForm(prev => ({
          ...prev,
          details: detailsText,
          price: suggestedPrice || prev.price
        }));

        // Stock validation
        if ((Number(fabric.quantity) || 0) <= 0) {
          setStockError(`تنبيه: قماش "${fabric.name}" نفد من المخزون تماماً.`);
        } else if (parsed > fabric.quantity) {
          setStockError(`عذراً، الأمتار المطلوبة (${parsed} م) غير متوفرة. المتوفر حالياً بالمخزون هو ${fabric.quantity} متر فقط.`);
        } else {
          setStockError(null);
        }
      }
    } else if (rawVal === '' || rawVal === '.') {
      setStockError('يرجى كتابة عدد أمتار صحيح.');
    }
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setStockError(null);

    if (!orderForm.customerName.trim()) {
      setStockError('يرجى كتابة اسم العميل.');
      return;
    }

    const priceNum = parseFloat(orderForm.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setStockError('يرجى إدخال مبلغ إجمالي صحيح.');
      return;
    }

    const chosenFabric = fabrics.find(f => f.id === selectedFabricId);
    const parsedFromInput = parseFloat(metersInputStr);
    const effectiveMeters = !isNaN(parsedFromInput) && parsedFromInput > 0
      ? Math.round(parsedFromInput * 10) / 10
      : selectedMeters;

    // CRITICAL: Strict stock verification if choosing a fabric from inventory
    // CRITICAL: Strict stock verification if choosing physical fabric from inventory
    if (!customFabricMode && selectedFabricId && chosenFabric) {
      const isCatalog = chosenFabric.sourcingType === 'catalog' || Boolean(chosenFabric.supplierName);
      if (!isCatalog) {
        const availableQty = Number(chosenFabric.quantity) || 0;

        if (modalMode === 'create') {
          if (availableQty <= 0) {
            setStockError(`عذراً، لا يمكن إتمام الطلب: قماش "${chosenFabric.name}" نفد من المخزون (0 متر متوفر).`);
            return;
          }
          if (effectiveMeters > availableQty) {
            setStockError(`عذراً، لا يمكن إتمام الطلب: الأمتار المطلوبة (${effectiveMeters} م) أكبر من المتوفر بالمخزون (${availableQty} م فقط).`);
            return;
          }
          if (effectiveMeters <= 0) {
            setStockError('يرجى إدخال عدد أمتار صحيح أكبر من الصفر.');
            return;
          }
        } else if (modalMode === 'edit') {
          // In edit mode, take into account already reserved meters
          const prevOrder = orders.find(o => o.id === editingOrderId);
          const prevMeters = (prevOrder?.fabricId === selectedFabricId) ? (prevOrder.fabricMeters || 0) : 0;
          const totalEffective = availableQty + prevMeters;

          if (effectiveMeters > totalEffective) {
            setStockError(`عذراً، لا يمكن إتمام التعديل: الأمتار المطلوبة (${effectiveMeters} م) تتجاوز الكمية المتوفرة (${totalEffective} م).`);
            return;
          }
        }
      }
    } else if (!customFabricMode && availableFabrics.length > 0 && !selectedFabricId) {
      setStockError('يرجى الضغط على أحد الأقمشة من القائمة الأفقية لاختياره.');
      return;
    }

    if (!orderForm.details.trim()) {
      setStockError('يرجى تحديد القماش أو كتابة تفاصيل الطلب.');
      return;
    }

    const createdAtMs = fromDatetimeLocal(orderForm.datetimeStr);

    // STEP 1: Inventory deductions (Packaging items + Fabric meters)
    let updatedFabrics = [...fabrics];

    if (modalMode === 'create') {
      updatedFabrics = updatedFabrics.map(f => {
        let currentQty = Number(f.quantity) || 0;

        // 1. Deduct 1 piece from ALL packaging items for every new order
        if (f.category === 'تغليف') {
          return { ...f, quantity: Math.max(0, currentQty - 1) };
        }

        // 2. Deduct meters from selected fabric if physical stock (not catalog)
        if (!customFabricMode && selectedFabricId && f.id === selectedFabricId) {
          const isCatalog = f.sourcingType === 'catalog' || Boolean(f.supplierName);
          if (!isCatalog) {
            const newQty = Math.max(0, currentQty - effectiveMeters);
            return { ...f, quantity: Math.round(newQty * 10) / 10 };
          }
        }

        return f;
      });

      setFabrics(updatedFabrics);
      persistInventory(updatedFabrics).catch(() => {});
    } else if (modalMode === 'edit') {
      if (!customFabricMode && selectedFabricId && chosenFabric) {
        const isCatalog = chosenFabric.sourcingType === 'catalog' || Boolean(chosenFabric.supplierName);
        if (!isCatalog) {
          const prevOrder = orders.find(o => o.id === editingOrderId);
          // If order had a previous fabric, restore its meters first
          if (prevOrder?.fabricId) {
            updatedFabrics = updatedFabrics.map(f => {
              if (f.id === prevOrder.fabricId) {
                const restored = (Number(f.quantity) || 0) + (prevOrder.fabricMeters || 0);
                return { ...f, quantity: Math.round(restored * 10) / 10 };
              }
              return f;
            });
          }
          // Deduct new meters
          updatedFabrics = updatedFabrics.map(f => {
            if (f.id === selectedFabricId) {
              const newQty = Math.max(0, (Number(f.quantity) || 0) - effectiveMeters);
              return { ...f, quantity: Math.round(newQty * 10) / 10 };
            }
            return f;
          });

          setFabrics(updatedFabrics);
          persistInventory(updatedFabrics).catch(() => {});
        }
      }
    }

    // STEP 2: Save order
    const finalDetails = orderForm.details.trim();
    const finalFabricId = !customFabricMode && selectedFabricId ? selectedFabricId : undefined;
    const finalFabricMeters = !customFabricMode && selectedFabricId ? effectiveMeters : undefined;
    const finalFabricName = !customFabricMode && chosenFabric ? chosenFabric.name : undefined;

    if (modalMode === 'edit' && editingOrderId) {
      const updatedOrders = orders.map(o => {
        if (o.id === editingOrderId) {
          return {
            ...o,
            customerName: orderForm.customerName.trim(),
            phone: orderForm.phone.trim(),
            details: finalDetails,
            price: priceNum,
            total: priceNum,
            status: orderForm.status,
            paymentStatus: orderForm.paymentStatus || 'تم الدفع',
            paymentMethod: orderForm.paymentMethod,
            deliveryType: orderForm.deliveryType || 'قدوم شخصي',
            governorate: orderForm.deliveryType === 'توصيل' ? orderForm.governorate : undefined,
            area: orderForm.deliveryType === 'توصيل' ? orderForm.area : undefined,
            deliveryZone: orderForm.deliveryType === 'توصيل' ? (`${orderForm.governorate} - ${orderForm.area}` as DeliveryZone) : undefined,
            deliveryFee: orderForm.deliveryType === 'توصيل' ? Number(orderForm.deliveryFee || 0) : 0,
            notes: orderForm.notes.trim(),
            createdAt: createdAtMs,
            fabricId: finalFabricId,
            fabricMeters: finalFabricMeters,
            fabricName: finalFabricName
          };
        }
        return o;
      });
      saveOrders(updatedOrders);
    } else {
      const newOrderData: Order = {
        id: Math.random().toString(36).substring(2, 8).toUpperCase(),
        customerName: orderForm.customerName.trim(),
        phone: orderForm.phone.trim(),
        details: finalDetails,
        price: priceNum,
        total: priceNum,
        status: orderForm.status,
        paymentStatus: orderForm.paymentStatus || 'تم الدفع',
        paymentMethod: orderForm.paymentMethod,
        deliveryType: orderForm.deliveryType || 'قدوم شخصي',
        governorate: orderForm.deliveryType === 'توصيل' ? orderForm.governorate : undefined,
        area: orderForm.deliveryType === 'توصيل' ? orderForm.area : undefined,
        deliveryZone: orderForm.deliveryType === 'توصيل' ? (`${orderForm.governorate} - ${orderForm.area}` as DeliveryZone) : undefined,
        deliveryFee: orderForm.deliveryType === 'توصيل' ? Number(orderForm.deliveryFee || 0) : 0,
        notes: orderForm.notes.trim(),
        createdAt: createdAtMs,
        fabricId: finalFabricId,
        fabricMeters: finalFabricMeters,
        fabricName: finalFabricName
      };
      const updatedOrders = [newOrderData, ...orders];
      saveOrders(updatedOrders);
      setSelectedInvoice(newOrderData);
    }

    setShowModal(false);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    const orderId = orderToDelete.id;

    // Restore packaging and fabric meters
    let restoredFabrics = fabrics.map(f => {
      let qty = Number(f.quantity) || 0;
      if (f.category === 'تغليف') {
        return { ...f, quantity: qty + 1 };
      }
      if (orderToDelete.fabricId && f.id === orderToDelete.fabricId && orderToDelete.fabricMeters) {
        return { ...f, quantity: Math.round((qty + orderToDelete.fabricMeters) * 10) / 10 };
      }
      return f;
    });
    setFabrics(restoredFabrics);
    persistInventory(restoredFabrics).catch(() => {});

    setOrderToDelete(null);
    if (selectedInvoice?.id === orderId) {
      setSelectedInvoice(null);
    }
    const updated = await deleteOrderPermanently(orderId);
    setOrders(updated);
  };

  const handleToggleStatus = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = orders.map(o => {
      if (o.id === id) {
        const nextStatus: OrderStatus = o.status === 'تم التسليم' ? 'قيد التجهيز' : 'تم التسليم';
        return { ...o, status: nextStatus };
      }
      return o;
    });
    saveOrders(updated);
  };

  const handleTogglePaymentStatus = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = orders.map(o => {
      if (o.id === id) {
        let nextPayment: PaymentStatus;
        if (o.paymentStatus === 'تم الدفع') nextPayment = 'قيد الدفع';
        else if (o.paymentStatus === 'قيد الدفع') nextPayment = 'آجل';
        else nextPayment = 'تم الدفع';
        return { ...o, paymentStatus: nextPayment };
      }
      return o;
    });
    saveOrders(updated);
  };

  const generatePDF = async (order: Order) => {
    const element = document.getElementById('printable-invoice');
    if (element) {
      try {
        const html2canvasModule = await import('html2canvas');
        const html2canvas = html2canvasModule.default;
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const doc = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 140;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const x = (210 - imgWidth) / 2;
        doc.addImage(imgData, 'PNG', x, 20, imgWidth, imgHeight);
        doc.save(`فاتورة_${order.customerName || 'عميل'}_${order.id}.pdf`);
        return;
      } catch (err) {
        console.warn('html2canvas PDF generation note:', err);
      }
    }
    window.print();
  };

  // Filter logic with custom date range and payment status
  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      o.customerName?.toLowerCase().includes(q) ||
      o.phone?.includes(q) ||
      o.details?.toLowerCase().includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      (o.notes && o.notes.toLowerCase().includes(q))
    );
    if (!matchesSearch) return false;

    if (statusFilter !== 'all' && o.status !== statusFilter) {
      return false;
    }

    if (paymentStatusFilter !== 'all') {
      if (o.paymentStatus !== paymentStatusFilter) return false;
    }

    if (startDate) {
      const startTimestamp = new Date(startDate).setHours(0, 0, 0, 0);
      if (o.createdAt < startTimestamp) return false;
    }

    if (endDate) {
      const endTimestamp = new Date(endDate).setHours(23, 59, 59, 999);
      if (o.createdAt > endTimestamp) return false;
    }

    return true;
  });

  const paidRevenue = orders
    .filter(o => o.paymentStatus === 'تم الدفع' && o.status !== 'ملغي')
    .reduce((sum, o) => sum + (Number(o.total || o.price) || 0), 0);
  const pendingPaymentRevenue = orders
    .filter(o => (o.paymentStatus === 'قيد الدفع' || o.paymentStatus === 'آجل') && o.status !== 'ملغي')
    .reduce((sum, o) => sum + (Number(o.total || o.price) || 0), 0);
  const pendingPaymentCount = orders.filter(o => o.paymentStatus === 'قيد الدفع' && o.status !== 'ملغي').length;
  const creditPaymentCount = orders.filter(o => o.paymentStatus === 'آجل' && o.status !== 'ملغي').length;
  const paidOrdersCount = orders.filter(o => o.paymentStatus === 'تم الدفع' && o.status !== 'ملغي').length;
  const pendingCount = orders.filter(o => (o.status === 'قيد التجهيز' || !o.status) && o.status !== 'ملغي').length;
  const isDateFiltered = Boolean(startDate || endDate);

  return (
    <div className="space-y-3.5 pb-6">
      {/* Top Header & Add Button */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-[#C7B895]/30 shadow-xs">
        <div>
          <h1 className="text-base font-extrabold text-[#1D3A30]">الطلبات</h1>
          <p className="text-[11px] text-[#1D3A30]/70 font-medium">
            {orders.length} طلب • {paidRevenue.toFixed(2)} د.ب محصّل
            {(pendingPaymentCount > 0 || creditPaymentCount > 0) && (
              <span className="text-amber-800 font-bold mr-1.5">
                • {pendingPaymentRevenue.toFixed(2)} د.ب معلّق/آجل
              </span>
            )}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary-atelier px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#E8D5A8]" />
          <span>طلب جديد</span>
        </button>
      </div>

      {/* Mobile Search & Filter Chips */}
      <div className="space-y-2">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#1D3A30]/40" />
          <input
            type="text"
            placeholder="بحث باسم العميل، رقم الهاتف، أو القماش..."
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

        {/* Horizontal Scrollable Filter Chips (no scrollbar) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => {
              setStatusFilter('all');
              setPaymentStatusFilter('all');
            }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
              statusFilter === 'all' && paymentStatusFilter === 'all'
                ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs'
                : 'bg-white text-[#1D3A30]/80 border border-[#C7B895]/30 hover:bg-[#FAF7F0]'
            }`}
          >
            الكل ({orders.length})
          </button>

          {/* Payment status filter: Paid */}
          <button
            onClick={() => setPaymentStatusFilter(paymentStatusFilter === 'تم الدفع' ? 'all' : 'تم الدفع')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
              paymentStatusFilter === 'تم الدفع'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>تم الدفع ({paidOrdersCount})</span>
          </button>

          {/* Payment status filter: Pending payment */}
          <button
            onClick={() => setPaymentStatusFilter(paymentStatusFilter === 'قيد الدفع' ? 'all' : 'قيد الدفع')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
              paymentStatusFilter === 'قيد الدفع'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-600" />
            <span>قيد الدفع ({pendingPaymentCount})</span>
          </button>

          {/* Payment status filter: Credit / Ajel */}
          <button
            onClick={() => setPaymentStatusFilter(paymentStatusFilter === 'آجل' ? 'all' : 'آجل')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
              paymentStatusFilter === 'آجل'
                ? 'bg-purple-800 text-white shadow-xs'
                : 'bg-white text-purple-800 border border-purple-300 hover:bg-purple-50'
            }`}
          >
            <Clock className="w-3 h-3 text-purple-600" />
            <span>آجل ({creditPaymentCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'قيد التجهيز' ? 'all' : 'قيد التجهيز')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
              statusFilter === 'قيد التجهيز'
                ? 'bg-[#A99872] text-[#FAF7F0] shadow-xs'
                : 'bg-white text-[#A99872] border border-[#C7B895]/50 hover:bg-[#FAF7F0]'
            }`}
          >
            قيد التجهيز ({pendingCount})
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'تم التسليم' ? 'all' : 'تم التسليم')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
              statusFilter === 'تم التسليم'
                ? 'bg-[#1D3A30] text-[#E8D5A8] shadow-xs'
                : 'bg-white text-[#1D3A30] border border-[#1D3A30]/30 hover:bg-[#FAF7F0]'
            }`}
          >
            تم التسليم ({orders.length - pendingCount})
          </button>

          {/* Date Range Toggle Button */}
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              isDateFiltered || showDateFilter
                ? 'bg-[#1D3A30] text-[#E8D5A8] border border-[#C7B895]/60 shadow-xs'
                : 'bg-white text-[#1D3A30]/80 border border-[#C7B895]/30 hover:bg-[#FAF7F0]'
            }`}
            title="فرز وتحديد الطلبات حسب فترة تواريخ مخصصة"
          >
            <Calendar className="w-3.5 h-3.5 text-[#C7B895]" />
            <span>فرز بالتاريخ</span>
            {isDateFiltered && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          {isDateFiltered && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition whitespace-nowrap cursor-pointer"
              title="إلغاء فرز التواريخ"
            >
              إلغاء التاريخ ✕
            </button>
          )}
        </div>

        {/* Expandable Custom Date Range Filter Panel */}
        <AnimatePresence>
          {showDateFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden bg-white p-3 rounded-2xl border border-[#C7B895]/40 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1D3A30] flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#C7B895]" />
                  تحديد الطلبات في فترة تواريخ مخصصة:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setStartDate(todayStr);
                      setEndDate(todayStr);
                    }}
                    className="text-[10px] font-bold text-[#1D3A30] bg-[#FAF7F0] px-2 py-0.5 rounded border border-[#C7B895]/30 hover:bg-[#E8D5A8]/50"
                  >
                    اليوم
                  </button>
                  <button
                    onClick={() => {
                      const d = new Date();
                      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
                      const todayStr = d.toISOString().split('T')[0];
                      setStartDate(firstDay);
                      setEndDate(todayStr);
                    }}
                    className="text-[10px] font-bold text-[#1D3A30] bg-[#FAF7F0] px-2 py-0.5 rounded border border-[#C7B895]/30 hover:bg-[#E8D5A8]/50"
                  >
                    هذا الشهر
                  </button>
                  <button
                    onClick={() => setShowDateFilter(false)}
                    className="text-[#1D3A30]/50 hover:text-[#1D3A30] p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-[#1D3A30]/70 mb-1">
                    تاريخ البداية (من):
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#FAF7F0] border border-[#C7B895]/40 rounded-xl px-2.5 py-1.5 text-xs text-[#1D3A30] focus:outline-none focus:ring-1 focus:ring-[#1D3A30]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#1D3A30]/70 mb-1">
                    تاريخ النهاية (إلى):
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#FAF7F0] border border-[#C7B895]/40 rounded-xl px-2.5 py-1.5 text-xs text-[#1D3A30] focus:outline-none focus:ring-1 focus:ring-[#1D3A30]"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Orders Mobile Feed List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-[#C7B895]/30 shadow-xs">
          <FileText className="w-10 h-10 text-[#C7B895]/60 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#1D3A30]">لا توجد طلبات مطابقة</h3>
          <p className="text-xs text-[#1D3A30]/60 mt-1">جرب تغيير شروط البحث أو الفلاتر</p>
          <button
            onClick={openCreateModal}
            className="btn-primary-atelier mt-4 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-[#E8D5A8]" />
            <span>إضافة أول طلب الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredOrders.map((order) => {
            const { full, isToday } = formatDateTime(order.createdAt);
            const cleanPhone = order.phone?.replace(/[^0-9]/g, '');

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-3.5 border border-[#C7B895]/30 shadow-xs hover:border-[#C7B895] transition"
              >
                {/* Card Top: ID, Status Toggle, Payment Status Toggle, Price */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#C7B895]/20">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono bg-[#FAF7F0] text-[#1D3A30] font-bold px-2 py-0.5 rounded-md border border-[#C7B895]/25">
                      #{order.id}
                    </span>
                    
                    {/* Status button (1-tap to switch delivery status) */}
                    <button
                      onClick={(e) => handleToggleStatus(order.id, e)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition active:scale-95 border cursor-pointer ${
                        order.status === 'تم التسليم'
                          ? 'bg-[#1D3A30] text-[#E8D5A8] border-[#C7B895]/40'
                          : 'bg-[#FAF7F0] text-[#A99872] border-[#C7B895]'
                      }`}
                      title="اضغط لتغيير حالة الطلب (قيد التجهيز / تم التسليم)"
                    >
                      {order.status === 'تم التسليم' ? (
                        <CheckCircle2 className="w-3 h-3 text-[#E8D5A8]" />
                      ) : (
                        <Clock className="w-3 h-3 text-[#A99872]" />
                      )}
                      <span>{order.status || 'قيد التجهيز'}</span>
                    </button>

                    {/* Payment Status button (1-tap to cycle paid -> pending -> credit) */}
                    <button
                      onClick={(e) => handleTogglePaymentStatus(order.id, e)}
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 transition active:scale-95 border cursor-pointer ${
                        order.paymentStatus === 'قيد الدفع'
                          ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200 shadow-2xs'
                          : order.paymentStatus === 'آجل'
                          ? 'bg-purple-100 text-purple-950 border-purple-300 hover:bg-purple-200 shadow-2xs'
                          : 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200 shadow-2xs'
                      }`}
                      title={order.paymentStatus === 'تم الدفع' ? 'تم الدفع: محسوب في الأرباح (اضغط للتغيير)' : order.paymentStatus === 'قيد الدفع' ? 'قيد الدفع: معلّق (اضغط للتغيير لـ آجل)' : 'آجل (دين): معلّق (اضغط للتحويل لـ تم الدفع)'}
                    >
                      {order.paymentStatus === 'قيد الدفع' ? (
                        <>
                          <Clock className="w-3 h-3 text-amber-700 animate-pulse" />
                          <span>قيد الدفع</span>
                        </>
                      ) : order.paymentStatus === 'آجل' ? (
                        <>
                          <Clock className="w-3 h-3 text-purple-700" />
                          <span>آجل (دين)</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3 text-emerald-700" />
                          <span>تم الدفع</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-left flex-shrink-0">
                    <span className="text-sm font-black text-[#1D3A30] font-mono block leading-tight">
                      {Number(order.price || order.total).toFixed(2)}{' '}
                      <span className="text-[10px] font-bold text-[#A99872]">د.ب</span>
                    </span>
                  </div>
                </div>

                {/* Card Body: Customer & Fabric Details */}
                <div className="py-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#1D3A30]">
                      {order.customerName}
                    </h3>
                    
                    {cleanPhone && (
                      <div className="flex items-center gap-1">
                        <a
                          href={`tel:${cleanPhone}`}
                          className="text-[10px] font-mono text-[#1D3A30]/80 hover:text-[#1D3A30]"
                        >
                          {order.phone}
                        </a>
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-6 h-6 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg flex items-center justify-center transition shadow-xs active:scale-90"
                          title="مراسلة الزبون عبر واتساب"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[#1D3A30]/80 font-medium mt-1 leading-relaxed">
                    {order.details}
                  </p>

                  {/* Delivery Mode Badge */}
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {order.deliveryType === 'توصيل' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#25493D]/10 text-[#1D3A30] border border-[#C7B895]/40">
                        <Truck className="w-3 h-3 text-[#A99872]" />
                        <span>
                          توصيل {order.governorate ? `• ${order.governorate}` : (order.deliveryZone ? `• ${order.deliveryZone}` : '')}
                          {order.area && (!order.deliveryZone || !order.deliveryZone.includes(order.area)) ? ` (${order.area})` : ''}
                          {Number(order.deliveryFee || 0) > 0 && ` (+${Number(order.deliveryFee).toFixed(2)} د.ب)`}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF7F0] text-[#1D3A30]/80 border border-[#C7B895]/30">
                        <User className="w-3 h-3 text-[#A99872]" />
                        <span>قدوم شخصي</span>
                      </span>
                    )}
                  </div>

                  {/* Fabric Sourcing Info on Order Card */}
                  {order.fabricId && (() => {
                    const linked = fabrics.find(f => f.id === order.fabricId);
                    if (!linked) return null;
                    const isCat = linked.sourcingType === 'catalog' || Boolean(linked.supplierName);
                    return (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {isCat ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF7F0] text-[#1D3A30] border border-[#C7B895]/50">
                            <BookOpen className="w-3 h-3 text-[#C7B895]" />
                            <span>شراء من المحل: {linked.supplierName || 'غير محدد'} {linked.catalogCode ? `• كود: ${linked.catalogCode}` : ''}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-[#1D3A30]/80 border border-stone-200">
                            <Layers className="w-3 h-3 text-[#A99872]" />
                            <span>من المخزون ({order.fabricMeters || 3.5} م)</span>
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {order.notes && (
                    <p className="text-[10px] bg-[#FAF7F0] text-[#1D3A30] p-1.5 rounded-lg mt-1.5 border border-[#C7B895]/30">
                      ملاحظة: {order.notes}
                    </p>
                  )}
                </div>

                {/* Card Meta & Action Buttons Footer */}
                <div className="pt-2 border-t border-[#C7B895]/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#1D3A30]/70 font-mono">
                    <span className="bg-[#FAF7F0] px-1.5 py-0.5 rounded text-[#1D3A30] font-medium border border-[#C7B895]/20">
                      {order.paymentMethod || 'بنفت بي'}
                    </span>
                    <span>•</span>
                    <span className={isToday ? "font-bold text-[#1D3A30]" : ""}>
                      {full}
                    </span>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedInvoice(order)}
                      className="p-1.5 text-[#1D3A30] hover:bg-[#FAF7F0] rounded-lg transition"
                      title="معاينة الفاتورة"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(order)}
                      className="p-1.5 text-[#A99872] hover:bg-[#FAF7F0] rounded-lg transition"
                      title="تعديل تفاصيل الطلب"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => generatePDF(order)}
                      className="p-1.5 text-[#1D3A30] hover:bg-[#FAF7F0] rounded-lg transition"
                      title="تحميل PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setOrderToDelete(order)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="حذف الطلب الخاطئ"
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

      {/* Create / Edit Modal (Mobile Native Bottom Sheet / Card) */}
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
              {/* Modal Header */}
              <div className="p-4 border-b border-[#C7B895]/30 flex justify-between items-center bg-[#1D3A30] text-[#FAF7F0]">
                <div>
                  <h3 className="text-sm font-bold text-[#FAF7F0]">
                    {modalMode === 'edit' ? 'تعديل بيانات الطلب' : 'تسجيل طلب مبيعات جديد'}
                  </h3>
                  <p className="text-[10px] text-[#E8D5A8]">
                    {modalMode === 'edit' ? 'تصحيح الأخطاء أو تعديل التوقيت' : 'أدخل بيانات العميل والمبلغ'}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg bg-white/10 text-[#E8D5A8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form Interior */}
              <form onSubmit={handleSaveOrder} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs no-scrollbar">
                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    اسم العميل *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أم عبدالله، سارة جاسم..."
                    value={orderForm.customerName}
                    onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                      رقم الهاتف / واتساب
                    </label>
                    <input
                      type="tel"
                      placeholder="97333XXXXXX"
                      value={orderForm.phone}
                      onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-mono text-[#1D3A30]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                      المبلغ الإجمالي (د.ب) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={orderForm.price}
                      onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-bold font-mono text-[#1D3A30]"
                    />
                  </div>
                </div>

                {/* Fabric Selection or Manual Entry */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-[#1D3A30]">
                      تفاصيل الطلب / الأقمشة *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomFabricMode(!customFabricMode);
                        setStockError(null);
                      }}
                      className="text-[10px] text-[#A99872] hover:text-[#1D3A30] font-bold underline transition"
                    >
                      {customFabricMode ? 'العودة لاختيار أقمشة المخزون' : 'كتابة تفاصيل يدوية'}
                    </button>
                  </div>

                  {customFabricMode ? (
                    <textarea
                      required
                      rows={2}
                      placeholder="مثال: 5 متر قماش حرير طبيعي أسود مع تطريز خفيف..."
                      value={orderForm.details}
                      onChange={(e) => setOrderForm({ ...orderForm, details: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {/* Horizontal scrollable box containing fabrics with images ("المستطيل") */}
                      <div className="relative bg-[#FAF7F0] p-2.5 rounded-2xl border border-[#C7B895]/40">
                        {availableFabrics.length === 0 ? (
                          <div className="text-center py-5 px-3">
                            <Layers className="w-8 h-8 text-[#C7B895] mx-auto mb-1.5 opacity-70" />
                            <p className="text-xs font-bold text-[#1D3A30]">لا توجد أقمشة مسجلة في المخزون حالياً</p>
                            <p className="text-[10px] text-[#A99872] mt-0.5">يمكنك إضافة أقمشة من قسم المخزون أو كتابة التفاصيل يدوياً</p>
                            <button
                              type="button"
                              onClick={() => setCustomFabricMode(true)}
                              className="mt-2 text-[11px] font-bold text-[#1D3A30] bg-white border border-[#C7B895]/40 px-3 py-1.5 rounded-xl hover:bg-[#FAF7F0] transition"
                            >
                              كتابة تفاصيل القماش يدوياً
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between px-1 mb-2 text-[10px] text-[#A99872]">
                              <span className="font-medium">اضغط على أحد الأقمشة لاختياره (اسحب أفقياً):</span>
                              <span className="font-bold font-mono">{availableFabrics.length} قماش مسجل</span>
                            </div>

                            {/* Horizontal scroll carousel */}
                            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x">
                              {availableFabrics.map((f) => {
                                const isSelected = selectedFabricId === f.id;
                                const qty = Number(f.quantity) || 0;
                                const isOutOfStock = qty <= 0;
                                const img = f.imageUrl || f.image;

                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => handleSelectFabric(f)}
                                    className={cn(
                                      "flex-shrink-0 w-28 p-2 rounded-xl text-right transition-all duration-200 relative snap-start flex flex-col items-center group",
                                      isSelected
                                        ? "bg-[#1D3A30] text-[#FAF7F0] ring-2 ring-[#C7B895] shadow-md border border-[#C7B895]"
                                        : isOutOfStock
                                        ? "bg-white/70 border border-red-200 opacity-60 hover:opacity-90"
                                        : "bg-white border border-[#C7B895]/30 hover:border-[#1D3A30]/50 hover:shadow-xs"
                                    )}
                                  >
                                    {/* Image Container */}
                                    <div className="relative w-full h-20 rounded-lg overflow-hidden bg-stone-100 mb-1.5 flex items-center justify-center">
                                      {img ? (
                                        <img
                                          src={img}
                                          alt={f.name}
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-[#A99872] bg-[#FAF7F0]">
                                          <Layers className="w-6 h-6 opacity-60" />
                                          <span className="text-[9px] mt-0.5 text-[#A99872]/80 font-bold">نَسْجَة</span>
                                        </div>
                                      )}

                                      {/* Selection Indicator Badge */}
                                      {isSelected && (
                                        <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                          <Check className="w-3 h-3 stroke-[3]" />
                                        </div>
                                      )}

                                      {/* Stock pill badge */}
                                      <div className="absolute bottom-1 right-1 left-1">
                                        <span className={cn(
                                          "block text-center text-[9px] font-bold py-0.5 px-1 rounded backdrop-blur-xs font-mono",
                                          (f.sourcingType === 'catalog' || Boolean(f.supplierName))
                                            ? "bg-[#1D3A30]/90 text-[#E8D5A8]"
                                            : isOutOfStock
                                            ? "bg-red-500/90 text-white"
                                            : isSelected
                                            ? "bg-[#FAF7F0]/95 text-[#1D3A30]"
                                            : "bg-[#1D3A30]/85 text-[#FAF7F0]"
                                        )}>
                                          {(f.sourcingType === 'catalog' || Boolean(f.supplierName))
                                            ? 'بالطلب (دفتر)'
                                            : (isOutOfStock ? 'نفد المخزون' : `${qty} م متوفر`)}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Fabric Name */}
                                    <p className={cn(
                                      "font-bold text-[11px] leading-tight line-clamp-2 w-full text-center h-7 flex items-center justify-center",
                                      isSelected ? "text-[#FAF7F0]" : "text-[#1D3A30]"
                                    )}>
                                      {f.name}
                                    </p>

                                    {/* Price per meter */}
                                    <p className={cn(
                                      "text-[10px] font-mono mt-1 font-bold",
                                      isSelected ? "text-[#E8D5A8]" : "text-[#A99872]"
                                    )}>
                                      {f.price} د.ب / م
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Meter Selection & Stock Availability Controls */}
                      {selectedFabricId && (() => {
                        const selectedFabric = fabrics.find(f => f.id === selectedFabricId);
                        if (!selectedFabric) return null;
                        const isCatalog = selectedFabric.sourcingType === 'catalog' || Boolean(selectedFabric.supplierName);
                        const availableQty = Number(selectedFabric.quantity) || 0;
                        const isInsufficient = !isCatalog && selectedMeters > availableQty;
                        const isOut = !isCatalog && availableQty <= 0;

                        return (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-white rounded-2xl border border-[#C7B895]/40 space-y-2.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Ruler className="w-4 h-4 text-[#1D3A30]" />
                                <span className="text-[11px] font-bold text-[#1D3A30]">
                                  عدد الأمتار المطلوبة من قماش ({selectedFabric.name}):
                                </span>
                              </div>
                              {isCatalog ? (
                                <span className="text-[10px] font-bold text-[#1D3A30] bg-[#FAF7F0] border border-[#C7B895]/50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <BookOpen className="w-3 h-3 text-[#C7B895]" />
                                  <span>شراء من: {selectedFabric.supplierName || 'المحل'} {selectedFabric.catalogCode ? `• كود: ${selectedFabric.catalogCode}` : ''}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-mono font-bold text-[#A99872]">
                                  المتوفر: {availableQty} م
                                </span>
                              )}
                            </div>

                            {/* Meter Stepper & Quick Pills (Supports half fractions like 22.5) */}
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center border border-[#C7B895]/40 rounded-xl overflow-hidden bg-[#FAF7F0] shadow-xs">
                                <button
                                  type="button"
                                  onClick={() => handleChangeMeters(Math.max(0.5, selectedMeters - 0.5))}
                                  className="px-2.5 py-2 hover:bg-[#C7B895]/20 text-[#1D3A30] transition active:scale-95"
                                  title="إنقاص نصف متر (-0.5)"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <div className="flex items-center px-1">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="22.5"
                                    value={metersInputStr}
                                    onChange={(e) => handleMetersInputChange(e.target.value)}
                                    onBlur={() => {
                                      const p = parseFloat(metersInputStr);
                                      if (!isNaN(p) && p > 0) {
                                        const clean = Math.round(p * 10) / 10;
                                        setSelectedMeters(clean);
                                        setMetersInputStr(String(clean));
                                      } else {
                                        setSelectedMeters(1);
                                        setMetersInputStr('1');
                                        handleChangeMeters(1);
                                      }
                                    }}
                                    className="w-16 text-center text-xs font-extrabold font-mono bg-transparent outline-none text-[#1D3A30] py-1.5"
                                  />
                                  <span className="text-[10px] text-[#A99872] font-bold px-1">متر</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleChangeMeters(selectedMeters + 0.5)}
                                  className="px-2.5 py-2 hover:bg-[#C7B895]/20 text-[#1D3A30] transition active:scale-95"
                                  title="زيادة نصف متر (+0.5)"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Quick Meter Chips with fractions like 3.5 & 22.5 */}
                              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                                {[1, 2, 3, 3.5, 4, 5, 10, 22.5].map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => handleChangeMeters(m)}
                                    className={cn(
                                      "px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition shrink-0",
                                      selectedMeters === m
                                        ? "bg-[#1D3A30] text-[#FAF7F0] shadow-xs"
                                        : "bg-[#FAF7F0] text-[#1D3A30] border border-[#C7B895]/30 hover:bg-[#C7B895]/20"
                                    )}
                                  >
                                    {m}م
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Suggested Price Calculation Breakdown */}
                            {selectedFabric.price > 0 && (
                              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#C7B895]/20 text-[#1D3A30]">
                                <span>حساب المبلغ المقترح ({selectedFabric.price} د.ب × {selectedMeters} م):</span>
                                <span className="font-mono font-bold text-[#1D3A30]">
                                  {(selectedFabric.price * selectedMeters).toFixed(2)} د.ب
                                </span>
                              </div>
                            )}

                            {/* Real-time Stock Verification Feedback */}
                            {isOut ? (
                              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                <span>عذراً، هذا القماش غير متوفر في المخزون (0 متر)! لا يمكن إتمام الطلب.</span>
                              </div>
                            ) : isInsufficient ? (
                              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                <span>
                                  الأمتار المطلوبة ({selectedMeters} م) أكبر من المتوفر ({availableQty} م فقط)! لا يمكن إتمام الطلب.
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                <span>
                                  الأمتار متوفرة — سيتم خصم {selectedMeters} متر ويتبقى في المخزون {Math.round((availableQty - selectedMeters) * 10) / 10} متر.
                                </span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Prominent Stock Error Alert */}
                  {stockError && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-[11px] font-bold animate-pulse">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                      <span>{stockError}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                      حالة الطلب
                    </label>
                    <select
                      value={orderForm.status}
                      onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value as OrderStatus })}
                      className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs bg-white text-[#1D3A30]"
                    >
                      <option value="قيد التجهيز">قيد التجهيز</option>
                      <option value="تم التسليم">تم التسليم</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                      طريقة الدفع
                    </label>
                    <select
                      value={orderForm.paymentMethod}
                      onChange={(e) => setOrderForm({ ...orderForm, paymentMethod: e.target.value as PaymentMethod })}
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

                {/* Payment Status Segmented Control */}
                <div className="bg-[#FAF7F0] p-2.5 rounded-xl border border-[#C7B895]/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-[#1D3A30]">
                      حالة سداد المبلغ
                    </label>
                    <span className="text-[10px] text-[#1D3A30]/65 font-bold">
                      {orderForm.paymentStatus === 'تم الدفع' ? '✓ يُحتسب فوراً في الأرباح' : '⚠ معلّق - لا يدخل في الأرباح'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOrderForm({ ...orderForm, paymentStatus: 'تم الدفع' })}
                      className={cn(
                        "p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-98",
                        orderForm.paymentStatus === 'تم الدفع'
                          ? "bg-emerald-800 text-white border-emerald-800 shadow-xs ring-1 ring-emerald-600"
                          : "bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-50"
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>تم الدفع</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOrderForm({ ...orderForm, paymentStatus: 'قيد الدفع' })}
                      className={cn(
                        "p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-98",
                        orderForm.paymentStatus === 'قيد الدفع'
                          ? "bg-amber-800 text-white border-amber-800 shadow-xs ring-1 ring-amber-600"
                          : "bg-white text-amber-900 border-amber-300 hover:bg-amber-50"
                      )}
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      <span>قيد الدفع</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOrderForm({ ...orderForm, paymentStatus: 'آجل' })}
                      className={cn(
                        "p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-98",
                        orderForm.paymentStatus === 'آجل'
                          ? "bg-purple-800 text-white border-purple-800 shadow-xs ring-1 ring-purple-600"
                          : "bg-white text-purple-900 border-purple-300 hover:bg-purple-50"
                      )}
                    >
                      <Clock className="w-3.5 h-3.5 text-purple-300" />
                      <span>آجل (دين)</span>
                    </button>
                  </div>
                </div>

                {/* Delivery Mechanism (آلية الاستلام والتوصيل) */}
                <div className="bg-[#FAF7F0] p-3 rounded-2xl border border-[#C7B895]/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-[#1D3A30] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#A99872]" />
                      <span>آلية الاستلام *</span>
                    </label>
                    <span className="text-[10px] text-[#A99872] font-bold">
                      {orderForm.deliveryType === 'توصيل' 
                        ? (orderForm.deliveryFee > 0 ? `+${orderForm.deliveryFee.toFixed(2)} د.ب` : 'مجاني')
                        : 'استلام مباشر'}
                    </span>
                  </div>

                  {/* 2 Main Buttons: قدوم شخصي vs توصيل */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeliveryTypeChange('قدوم شخصي')}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98",
                        orderForm.deliveryType === 'قدوم شخصي'
                          ? "bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs"
                          : "bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]"
                      )}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>قدوم شخصي</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeliveryTypeChange('توصيل')}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98",
                        orderForm.deliveryType === 'توصيل'
                          ? "bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs"
                          : "bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]"
                      )}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>توصيل</span>
                    </button>
                  </div>

                  {/* If توصيل is chosen, show the 4 governorates and cascading areas */}
                  {orderForm.deliveryType === 'توصيل' && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-2 border-t border-[#C7B895]/30 space-y-2.5"
                    >
                      <span className="text-[10px] font-bold text-[#1D3A30]/80 block">
                        المحافظة ورسوم التوصيل:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {(Object.keys(BAHRAIN_GOVERNORATES) as BahrainGovernorateName[]).map((govName) => {
                          const gov = BAHRAIN_GOVERNORATES[govName];
                          const isSelected = orderForm.governorate === govName;
                          return (
                            <button
                              key={govName}
                              type="button"
                              onClick={() => handleGovernorateChange(govName)}
                              className={cn(
                                "py-2 px-1 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-0.5",
                                isSelected
                                  ? "bg-[#1D3A30] text-[#E8D5A8] border-[#1D3A30] shadow-xs"
                                  : "bg-white text-[#1D3A30] border-[#C7B895]/40 hover:bg-[#FAF7F0]"
                              )}
                            >
                              <span className="text-[11px] font-black">{gov.shortName}</span>
                              <span className="text-[9px] font-bold opacity-90">
                                {gov.fee === 0.5 ? '500 فلس' : gov.fee === 1 ? '1.00 د.ب' : '2.00 د.ب'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Cascading Area Dropdown */}
                      <div>
                        <label className="text-[10px] font-bold text-[#1D3A30]/80 block mb-1">
                          منطقة التوصيل ({BAHRAIN_GOVERNORATES[orderForm.governorate as BahrainGovernorateName]?.name || 'المحافظة'}):
                        </label>
                        <select
                          value={orderForm.area}
                          onChange={(e) => handleAreaChange(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs bg-white text-[#1D3A30] font-bold"
                        >
                          {BAHRAIN_GOVERNORATES[orderForm.governorate as BahrainGovernorateName]?.areas.map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Date & Time Picker */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    تاريخ ووقت الطلب (بالدقيقة والساعة)
                  </label>
                  <input
                    type="datetime-local"
                    value={orderForm.datetimeStr}
                    onChange={(e) => setOrderForm({ ...orderForm, datetimeStr: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs font-mono text-[#1D3A30]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D3A30] mb-1">
                    ملاحظات إضافية
                  </label>
                  <input
                    type="text"
                    placeholder="أي تعليمات أو مقاسات خاصة..."
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#C7B895]/40 focus:ring-1 focus:ring-[#1D3A30] outline-none text-xs text-[#1D3A30]"
                  />
                </div>

                <div className="pt-2">
                  {(() => {
                    const chosen = fabrics.find(f => f.id === selectedFabricId);
                    const isStockBlocking = Boolean(
                      !customFabricMode && chosen && (
                        (Number(chosen.quantity) || 0) <= 0 ||
                        selectedMeters > (Number(chosen.quantity) || 0)
                      )
                    );

                    return (
                      <button
                        type="submit"
                        disabled={isStockBlocking}
                        className={cn(
                          "w-full py-3 rounded-xl text-xs font-black transition-all active:scale-98 shadow-sm cursor-pointer",
                          isStockBlocking
                            ? "bg-rose-100 text-rose-800 border border-rose-300 cursor-not-allowed opacity-80"
                            : "btn-primary-atelier"
                        )}
                      >
                        {isStockBlocking 
                          ? '⚠️ الأمتار غير متوفرة بالمخزون (لا يمكن إتمام الطلب)' 
                          : (modalMode === 'edit' ? 'حفظ التعديلات' : 'حفظ الطلب وإصدار الفاتورة')}
                      </button>
                    );
                  })()}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Preview Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              id="printable-invoice"
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col p-5 border border-[#C7B895]/40"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#C7B895]/20">
                <div className="flex items-center gap-2">
                  <NasjahLogo variant="emblem" size="xs" />
                  <span className="font-extrabold text-xs text-[#1D3A30] tracking-wider">
                    فاتورة نَسْجَة
                  </span>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-[#1D3A30]/60 hover:text-[#1D3A30] p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs">
                <div className="flex justify-between text-[11px] text-[#1D3A30]/70 font-mono">
                  <span>رقم الفاتورة: #{selectedInvoice.id}</span>
                  <span>{formatDateTime(selectedInvoice.createdAt).full}</span>
                </div>

                <div className="bg-[#FAF7F0] p-3 rounded-xl border border-[#C7B895]/20 space-y-1">
                  <p className="font-bold text-[#1D3A30] text-xs">{selectedInvoice.customerName}</p>
                  {selectedInvoice.phone && (
                    <p className="text-[11px] font-mono text-[#A99872]">{selectedInvoice.phone}</p>
                  )}
                  <p className="text-[11px] text-[#1D3A30]/80 mt-1">{selectedInvoice.details}</p>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-[#C7B895]/20">
                  <span className="font-bold text-xs text-[#1D3A30]">المجموع المطلوب:</span>
                  <span className="text-base font-black text-[#1D3A30] font-mono">
                    {Number(selectedInvoice.price || selectedInvoice.total).toFixed(2)} د.ب
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#1D3A30]/80">
                  <span>طريقة الدفع: {selectedInvoice.paymentMethod || 'بنفت بي'}</span>
                  <span>حالة الطلب: {selectedInvoice.status || 'قيد التجهيز'}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#1D3A30]/80">
                  <span>آلية الاستلام: {selectedInvoice.deliveryType || 'قدوم شخصي'}</span>
                  <span>
                    {selectedInvoice.deliveryType === 'توصيل' 
                      ? `${selectedInvoice.governorate ? selectedInvoice.governorate : (selectedInvoice.deliveryZone || 'توصيل')}${selectedInvoice.area && (!selectedInvoice.deliveryZone || !selectedInvoice.deliveryZone.includes(selectedInvoice.area)) ? ` (${selectedInvoice.area})` : ''} (${Number(selectedInvoice.deliveryFee || 0) > 0 ? `+${Number(selectedInvoice.deliveryFee).toFixed(2)} د.ب` : 'مجاني'})`
                      : 'استلام من المحل'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-[#1D3A30]/70 font-medium">حالة السداد والأرباح:</span>
                  {selectedInvoice.paymentStatus === 'قيد الدفع' ? (
                    <span className="text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                      <span>قيد الدفع (معلّق)</span>
                    </span>
                  ) : selectedInvoice.paymentStatus === 'آجل' ? (
                    <span className="text-purple-900 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-purple-600" />
                      <span>آجل (ذمة)</span>
                    </span>
                  ) : (
                    <span className="text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>تم الدفع (محصل)</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#C7B895]/20">
                <button
                  onClick={() => generatePDF(selectedInvoice)}
                  className="btn-primary-atelier py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#E8D5A8]" />
                  <span>تحميل PDF</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="btn-secondary-atelier py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#1D3A30]" />
                  <span>طباعة</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {orderToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderToDelete(null)}
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
              <h3 className="text-sm font-bold text-[#1D3A30]">تأكيد حذف الطلب</h3>
              <p className="text-xs text-[#1D3A30]/70">
                هل أنت متأكد من رغبتك في حذف طلب "{orderToDelete.customerName}" بمبلغ {orderToDelete.price} د.ب نهائياً من السجل؟
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={confirmDeleteOrder}
                  className="py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition shadow-xs"
                >
                  نعم، احذف الطلب
                </button>
                <button
                  onClick={() => setOrderToDelete(null)}
                  className="py-2.5 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200 transition"
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
