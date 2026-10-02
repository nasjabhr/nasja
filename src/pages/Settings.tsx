import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Smartphone, 
  Laptop, 
  Tablet, 
  Trash2, 
  LogOut, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Lock, 
  ExternalLink,
  Info,
  Sliders,
  ShieldAlert
} from 'lucide-react';
import { 
  getActiveSessions, 
  revokeSession, 
  revokeAllOtherSessions, 
  ConnectedDevice,
  registerCurrentSession 
} from '../lib/sessionService';
import { 
  getSecurityState, 
  resetFailedAttempts, 
  MAX_ALLOWED_ATTEMPTS, 
  BASE_LOCKOUT_SECONDS 
} from '../lib/security';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ConnectedDevice[]>([]);
  const [security, setSecurity] = useState(getSecurityState());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(() => {
    return parseInt(localStorage.getItem('nasjah_autolock_minutes') || '30', 10);
  });

  const loadSessions = () => {
    const active = getActiveSessions();
    setSessions(active);
    setSecurity(getSecurityState());
  };

  useEffect(() => {
    registerCurrentSession();
    loadSessions();
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRevokeSession = (sessionId: string, deviceName: string) => {
    const updated = revokeSession(sessionId);
    setSessions(updated);
    setFeedback({
      type: 'success',
      message: `تم إنهاء جلسة (${deviceName}) بنجاح.`
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleRevokeAllOthers = async () => {
    setIsRevokingAll(true);
    try {
      if (supabase) {
        await supabase.auth.signOut({ scope: 'others' });
      }
    } catch (e) {
      console.warn('Remote revoke sessions note:', e);
    }
    const updated = revokeAllOtherSessions();
    setSessions(updated);
    setIsRevokingAll(false);
    setFeedback({
      type: 'success',
      message: 'تم تسجيل الخروج وإنهاء جلسات كافة الأجهزة الأخرى فوراً.'
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleEmergencyLock = async () => {
    if (confirm('هل أنتِ متأكدة من رغبتكِ في القفل الأمني الفوري؟ سيتم طرد الجلسة وإغلاق لوحة التحكم فوراً.')) {
      if (supabase) {
        await supabase.auth.signOut();
      }
      navigate('/login');
    }
  };

  const handleResetLockout = () => {
    resetFailedAttempts();
    setSecurity(getSecurityState());
    setFeedback({
      type: 'success',
      message: 'تمت إعادة ضبط وتصفير سجل محاولات الدخول الخاطئة.'
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAutoLockChange = (minutes: number) => {
    setAutoLockMinutes(minutes);
    localStorage.setItem('nasjah_autolock_minutes', minutes.toString());
    setFeedback({
      type: 'success',
      message: minutes === 0 ? 'تم تعطيل القفل التلقائي عند الخمول.' : `تم ضبط القفل التلقائي عند الخمول بعد ${minutes} دقيقة.`
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const getDeviceIcon = (type: 'mobile' | 'tablet' | 'desktop') => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-[#1D3A30]" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-[#1D3A30]" />;
      case 'desktop':
      default:
        return <Laptop className="w-5 h-5 text-[#1D3A30]" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-[#1D3A30] to-[#24473B] text-[#FAF7F0] p-6 rounded-3xl border border-[#C7B895]/30 shadow-lg relative overflow-hidden">
        <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-[#C7B895]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span className="text-xs text-[#E8D5A8] font-bold tracking-wider">مركز الحماية والأجهزة</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">إدارة الأجهزة المتصلة والأمان</h1>
            <p className="text-xs text-[#FAF7F0]/80 mt-1 max-w-xl leading-relaxed">
              مراقبة كافة الهواتف والأجهزة المسجلة دخولاً للوحة التحكم حالياً، مع إمكانية طرد أي جهاز بضغطة زر لضمان سرية البيانات والمخزون.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/store-settings"
              className="flex items-center gap-1.5 bg-[#FAF7F0] hover:bg-white text-[#1D3A30] px-3.5 py-2.5 rounded-2xl text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer border border-[#C7B895]/40"
              title="إعدادات متجر الزبائن (الواتساب، المواسم)"
            >
              <Sliders className="w-4 h-4 text-[#A99872]" />
              <span>إعدادات متجر الزبائن</span>
            </Link>

            <button
              onClick={handleEmergencyLock}
              className="flex items-center gap-2 bg-rose-600/90 hover:bg-rose-700 text-white px-3.5 py-2.5 rounded-2xl text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
              title="قفل فوري للوحة الإدارة"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>قفل أمني فوري</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{feedback.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section 1: Connected Devices */}
      <div className="bg-white rounded-3xl p-6 border border-[#C7B895]/30 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-[#C7B895]/20">
          <div>
            <h2 className="text-base font-black text-[#1D3A30] flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#A99872]" />
              <span>الأجهزة المتصلة بلوحة التحكم ({sessions.length})</span>
            </h2>
            <p className="text-xs text-[#1D3A30]/60 mt-0.5">
              قائمة الأجهزة التي تم تسجيل الدخول منها حالياً
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSessions}
              className="p-2 text-[#1D3A30]/70 hover:text-[#1D3A30] hover:bg-[#FAF7F0] rounded-xl transition"
              title="تحديث قائمة الأجهزة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {sessions.length > 1 && (
              <button
                onClick={handleRevokeAllOthers}
                disabled={isRevokingAll}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition active:scale-95 disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل خروج باقي الأجهزة</span>
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className={`p-4 rounded-2xl border transition-all ${
                sess.isCurrent
                  ? 'bg-[#FAF7F0]/90 border-[#C7B895] ring-2 ring-[#C7B895]/20 shadow-xs'
                  : 'bg-white border-neutral-200 hover:border-[#C7B895]/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/30 flex items-center justify-center flex-shrink-0 shadow-2xs">
                    {getDeviceIcon(sess.deviceType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-[#1D3A30]">{sess.deviceName}</h3>
                      {sess.isCurrent && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          الجهاز الحالي (أنتِ الآن)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#1D3A30]/60 mt-1">
                      {sess.browser} • {sess.os}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-[#1D3A30]/70 font-mono">
                      <span>وقت الدخول: {sess.loginTime}</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">{sess.lastActive}</span>
                    </div>
                  </div>
                </div>

                {!sess.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(sess.id, sess.deviceName)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition"
                    title="تسجيل الخروج من هذا الجهاز"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Security Hardening & Guard Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Security Protocols Status */}
        <div className="bg-white rounded-3xl p-6 border border-[#C7B895]/30 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#C7B895]/20">
            <h2 className="text-sm font-black text-[#1D3A30] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>بروتوكولات الأمان الفعالة</span>
            </h2>
            <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              مؤمّن بالكامل
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/20">
              <div>
                <p className="font-bold text-[#1D3A30]">جدار الحماية ضد التخمين (Brute-Force)</p>
                <p className="text-[11px] text-[#1D3A30]/60">قفل الحساب تلقائياً بعد {MAX_ALLOWED_ATTEMPTS} محاولات خاطئة</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/20">
              <div>
                <p className="font-bold text-[#1D3A30]">حظر الروابط غير المصرح بها (Route Guard)</p>
                <p className="text-[11px] text-[#1D3A30]/60">طرد فوري لأي زائر يحاول فتح صفحات الإدارة مباشرة</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/20">
              <div>
                <p className="font-bold text-[#1D3A30]">التحقق بالرمز السريع (OTP / 2FA)</p>
                <p className="text-[11px] text-[#1D3A30]/60">دخول مشفر عبر البريد الإلكتروني المعتمد فقط</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </div>

          {security.attempts > 0 && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <div>
                <p className="font-bold">محاولات دخول غير ناجحة مؤخراً: {security.attempts}</p>
                {security.lastFailedAt && (
                  <p className="text-[10px] text-amber-800">آخر محاولة: {security.lastFailedAt}</p>
                )}
              </div>
              <button
                onClick={handleResetLockout}
                className="text-[11px] font-bold text-amber-900 underline hover:text-amber-950"
              >
                تصفير السجل
              </button>
            </div>
          )}
        </div>

        {/* Card B: Inactivity Auto-Lock & Storefront Isolation */}
        <div className="bg-white rounded-3xl p-6 border border-[#C7B895]/30 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#C7B895]/20">
            <h2 className="text-sm font-black text-[#1D3A30] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#A99872]" />
              <span>القفل التلقائي وعزل متجر الزبائن</span>
            </h2>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1D3A30] mb-2">
              مهلة قفل لوحة التحكم عند الخمول:
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[15, 30, 0].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleAutoLockChange(mins)}
                  className={`py-2 px-2.5 rounded-xl font-bold border transition text-center ${
                    autoLockMinutes === mins
                      ? 'bg-[#1D3A30] text-[#FAF7F0] border-[#1D3A30] shadow-xs'
                      : 'bg-[#FAF7F0] text-[#1D3A30] border-[#C7B895]/30 hover:bg-[#F2ECE0]'
                  }`}
                >
                  {mins === 0 ? 'تعطيل' : `${mins} دقيقة`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#1D3A30]/60 mt-2">
              يتم قفل الشاشة تلقائياً إذا لم تكن هناك أي حركة لحماية سرية الميزانية والمبيعات.
            </p>
          </div>

          <div className="pt-3 border-t border-[#C7B895]/20">
            <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#C7B895]/30 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#1D3A30]">رابط متجر الزبائن العام (/store)</p>
                <p className="text-[11px] text-[#1D3A30]/60">معزول بالكامل بدون إمكانية الدخول للوحة الإدارة</p>
              </div>
              <Link
                to="/store"
                target="_blank"
                className="flex items-center gap-1.5 text-xs font-bold bg-[#1D3A30] text-[#E8D5A8] px-3 py-1.5 rounded-xl hover:bg-[#25493D] transition shadow-2xs"
              >
                <span>معاينة المتجر</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
