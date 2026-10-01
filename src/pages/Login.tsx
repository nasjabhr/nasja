import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Clock,
  KeyRound,
  Send,
  CheckCircle2,
  ArrowRight,
  ShoppingBag
} from 'lucide-react';
import NasjahLogo from '../components/NasjahLogo';
import { 
  getSecurityState, 
  recordFailedAttempt, 
  resetFailedAttempts, 
  isEmailAuthorized,
  isUserAuthorized,
  SecurityState 
} from '../lib/security';
import { syncWithServer } from '../lib/dataService';
import { registerCurrentSession } from '../lib/sessionService';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Login method: 'password' | 'otp'
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Security State
  const [security, setSecurity] = useState<SecurityState>(getSecurityState());

  // Real-time security countdown timer when locked
  useEffect(() => {
    const timer = setInterval(() => {
      const current = getSecurityState();
      setSecurity(current);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatLockoutTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (security.isLocked) {
      setError(`يرجى الانتظار (${formatLockoutTime(security.remainingSeconds)}) أو استخدم الدخول عبر رمز التحقق المباشر.`);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Whitelist check
    if (!isEmailAuthorized(cleanEmail)) {
      setLoading(true);
      await new Promise((res) => setTimeout(res, 800));
      setLoading(false);

      const sec = recordFailedAttempt();
      setSecurity(sec);
      setError('بيانات الدخول غير مصرح لها.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (!supabase) throw new Error('حدث خطأ في الاتصال بقاعدة البيانات.');

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (data.session) {
        if (!isUserAuthorized(data.session.user)) {
          await supabase.auth.signOut();
          setError('غير مصرح لك بالدخول: الحساب لا يملك صلاحية المالك (UID غير مطابق).');
          return;
        }
        resetFailedAttempts();
        registerCurrentSession();
        try {
          await syncWithServer();
        } catch {}
        navigate('/');
      }
    } catch (err: any) {
      const sec = recordFailedAttempt();
      setSecurity(sec);

      if (sec.isLocked) {
        setError(`تم تجميد محاولات كلمة المرور مؤقتاً (${formatLockoutTime(sec.remainingSeconds)}). يمكنك الدخول فوراً عبر خيار "رمز التحقق السريع" بالأسفل.`);
      } else {
        setError('كلمة المرور غير صحيحة. يمكنك استخدام خيار "رمز التحقق السريع" للدخول فوراً عبر بريدك.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('يرجى إدخال البريد الإلكتروني أولاً.');
      return;
    }
    if (!isEmailAuthorized(cleanEmail)) {
      setError('هذا البريد الإلكتروني غير مسجل كحساب معتمد.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (!supabase) throw new Error('حدث خطأ في الاتصال.');
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false }
      });

      if (otpError) throw otpError;

      setOtpSent(true);
      setSuccessMsg('تم إرسال رمز الدخول السريع إلى بريدك الإلكتروني. افتح الرسالة وأدخل الرمز أدناه أو اضغط الرابط في الرسالة.');
    } catch (err: any) {
      setError(err.message || 'تعذر إرسال رمز التحقق، يرجى المحاولة بعد قليل.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = otpCode.trim();

    if (!cleanToken) {
      setError('يرجى إدخال الرمز المكون من 6 أرقام المستلم على بريدك.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!supabase) throw new Error('حدث خطأ في الاتصال.');
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email'
      });

      if (verifyError) throw verifyError;

      if (data.session) {
        if (!isUserAuthorized(data.session.user)) {
          await supabase.auth.signOut();
          setError('غير مصرح لك بالدخول: الحساب لا يملك صلاحية المالك (UID غير مطابق).');
          return;
        }
        resetFailedAttempts();
        registerCurrentSession();
        try {
          await syncWithServer();
        } catch {}
        navigate('/');
      }
    } catch (err: any) {
      setError('الرمز غير صحيح أو انتهت صلاحيته. يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('يرجى كتابة بريدك الإلكتروني أولاً.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('حدث خطأ في الاتصال.');
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin
      });
      setSuccessMsg('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
    } catch (err: any) {
      setError('تعذر إرسال رابط إعادة التعيين حالياً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full overflow-y-auto no-scrollbar bg-[#1D3A30] flex items-center justify-center p-4 font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-6 sm:p-8 rounded-[32px] shadow-2xl max-w-sm w-full text-center space-y-5 border border-[#C7B895]/30"
      >
        {/* Brand Header */}
        <div>
          <NasjahLogo variant="emblem" size="lg" className="mx-auto mb-3" />
          <h1 className="text-xl font-black text-[#1D3A30] tracking-wider">نَسْجَة للأقمشة</h1>
          <p className="text-[11px] text-[#1D3A30]/70 font-medium mt-1">بوابة الدخول والإدارة الموحدة للأجهزة</p>
        </div>

        {/* Lockout Notice */}
        <AnimatePresence>
          {security.isLocked && authMode === 'password' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-2xl text-xs text-right space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-800">
                <span className="flex items-center gap-1.5 font-sans font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" /> تجميد كلمة المرور:
                </span>
                <span className="bg-amber-200/80 px-2 py-0.5 rounded-lg text-amber-950 font-bold">
                  {formatLockoutTime(security.remainingSeconds)}
                </span>
              </div>
              <p className="text-[11px] text-amber-800 font-medium">
                لتجاوز الانتظار، اضغط أدناه على "الدخول برمز التحقق السريع" للدخول فوراً.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications */}
        {error && (
          <div className="bg-rose-50 text-rose-800 p-3 rounded-2xl text-xs border border-rose-200 text-right flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span className="text-xs font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-[#FAF7F0] text-[#1D3A30] p-3 rounded-2xl text-xs border border-[#C7B895]/50 text-right flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1D3A30] flex-shrink-0 mt-0.5" />
            <span className="text-xs font-medium leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-[#FAF7F0] p-1 rounded-xl border border-[#C7B895]/30 text-xs">
          <button
            type="button"
            onClick={() => { setAuthMode('password'); setError(''); setSuccessMsg(''); }}
            className={`py-2 font-bold rounded-lg transition ${
              authMode === 'password' ? 'bg-[#1D3A30] text-[#FAF7F0] shadow-xs' : 'text-[#1D3A30]/70 hover:text-[#1D3A30]'
            }`}
          >
            كلمة المرور
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('otp'); setError(''); setSuccessMsg(''); }}
            className={`py-2 font-bold rounded-lg transition ${
              authMode === 'otp' ? 'bg-[#1D3A30] text-[#FAF7F0] shadow-xs' : 'text-[#1D3A30]/70 hover:text-[#1D3A30]'
            }`}
          >
            رمز التحقق السريع
          </button>
        </div>

        {/* Form 1: Password Login */}
        {authMode === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-3.5 text-right">
            <div>
              <label className="block text-xs font-bold text-[#1D3A30] mb-1">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="البريد الإلكتروني المعتمد للإدارة"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#FAF7F0] border border-[#C7B895]/40 rounded-xl pr-9 pl-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#1D3A30] text-xs text-[#1D3A30] text-left dir-ltr"
                />
                <Mail className="w-4 h-4 text-[#1D3A30]/50 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#1D3A30]">
                  كلمة المرور
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[11px] text-[#A99872] hover:text-[#1D3A30] underline font-medium"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#FAF7F0] border border-[#C7B895]/40 rounded-xl pr-9 pl-9 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#1D3A30] text-xs text-[#1D3A30] font-mono"
                />
                <Lock className="w-4 h-4 text-[#1D3A30]/50 absolute right-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-2.5 text-[#1D3A30]/50 hover:text-[#1D3A30] p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] py-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 shadow-sm border border-[#C7B895]/30"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري تسجيل الدخول...
                </span>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>
          </form>
        )}

        {/* Form 2: Email OTP / Magic Link */}
        {authMode === 'otp' && (
          <div className="space-y-3.5 text-right">
            <div>
              <label className="block text-xs font-bold text-[#1D3A30] mb-1">
                البريد الإلكتروني المعتمد
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="البريد الإلكتروني المعتمد للإدارة"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#FAF7F0] border border-[#C7B895]/40 rounded-xl pr-9 pl-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#1D3A30] text-xs text-[#1D3A30] text-left dir-ltr"
                />
                <Mail className="w-4 h-4 text-[#1D3A30]/50 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {!otpSent ? (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] py-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 shadow-sm border border-[#C7B895]/30"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري إرسال الرمز...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-[#C7B895]" />
                    <span>إرسال رمز الدخول إلى الإيميل</span>
                  </span>
                )}
              </button>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#1D3A30] mb-1">
                    أدخل رمز التحقق (المكون من 6 أرقام)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="123456"
                      maxLength={8}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full bg-[#FAF7F0] border border-[#C7B895]/40 rounded-xl pr-9 pl-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#1D3A30] text-sm text-[#1D3A30] font-mono tracking-widest text-center"
                    />
                    <KeyRound className="w-4 h-4 text-[#1D3A30]/50 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1D3A30] hover:bg-[#25493D] text-[#E8D5A8] py-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 shadow-sm border border-[#C7B895]/30"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري التحقق...
                    </span>
                  ) : (
                    <span>تأكيد الرمز والدخول</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full text-center text-[11px] text-[#A99872] hover:text-[#1D3A30] py-1"
                >
                  إعادة إرسال الرمز مجدداً
                </button>
              </form>
            )}
          </div>
        )}

        {/* Link to public store */}
        <div className="pt-2 border-t border-[#C7B895]/20 text-center space-y-2">
          <Link
            to="/store"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-[#FAF7F0] hover:bg-[#F2ECE0] text-[#1D3A30] text-xs font-bold border border-[#C7B895]/40 transition active:scale-98"
          >
            <ShoppingBag className="w-4 h-4 text-[#A99872]" />
            <span>زيارة متجر الأقمشة الرجالية للزبائن</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#1D3A30]/50" />
          </Link>
          <p className="text-[10px] text-[#1D3A30]/60">
            مخصص لإدارة نَسْجَة • مزامنة سحابية مؤمّنة عبر Supabase
          </p>
        </div>
      </motion.div>
    </div>
  );
}

