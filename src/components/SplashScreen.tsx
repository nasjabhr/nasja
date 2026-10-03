import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import NasjahLogo from './NasjahLogo';

interface SplashScreenProps {
  statusText?: string;
  error?: string | null;
  onRetry?: () => void;
  subTitle?: string;
}

export default function SplashScreen({
  statusText = 'جارِ تحميل بيانات نَسْجَة من قاعدة البيانات...',
  error = null,
  onRetry,
  subTitle = 'أقمشة وخياطة راقية • مملكة البحرين',
}: SplashScreenProps) {
  const [showTimeoutHelp, setShowTimeoutHelp] = useState(false);

  // If loading takes more than 7 seconds, show a helpful retry action
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeoutHelp(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1D3A30] text-[#FAF7F0] select-none overflow-hidden px-4"
      dir="rtl"
    >
      {/* Background Decorative Radial Glow */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,_rgba(199,184,149,0.25)_0%,_transparent_70%)]" 
      />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center">
        {/* Animated Brand Emblem */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative mb-6"
        >
          {/* Subtle Outer Pulsing Halo */}
          <div className="absolute -inset-2.5 rounded-full bg-[#C7B895]/20 blur-md animate-pulse" />
          
          <div className="relative p-1 rounded-full ring-2 ring-[#C7B895]/70 shadow-[0_0_35px_rgba(199,184,149,0.35)] bg-[#1D3A30]">
            <NasjahLogo variant="emblem" size="xl" className="w-24 h-24 sm:w-28 sm:h-28" />
          </div>
        </motion.div>

        {/* Brand Name & Identity */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="space-y-1 mb-6"
        >
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-[#FAF7F0] font-sans">
            نَسْجَة
          </h1>
          <p className="text-xs sm:text-sm text-[#C7B895] font-medium tracking-wide">
            {subTitle}
          </p>
        </motion.div>

        {/* Loading Indicator or Error State */}
        {!error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full flex flex-col items-center space-y-4"
          >
            {/* Elegant Golden Progress Pulse */}
            <div className="w-48 sm:w-56 h-1.5 bg-[#FAF7F0]/15 rounded-full overflow-hidden relative">
              <motion.div
                className="absolute top-0 bottom-0 bg-gradient-to-l from-[#C7B895] via-[#E8D5A8] to-[#C7B895] rounded-full shadow-[0_0_10px_#E8D5A8]"
                initial={{ left: '-100%', right: '100%' }}
                animate={{
                  left: ['-50%', '100%'],
                  right: ['100%', '-50%'],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.6,
                  ease: 'easeInOut',
                }}
              />
            </div>

            {/* Status Text */}
            <p className="text-xs text-[#E8D5A8]/90 font-medium animate-pulse">
              {statusText}
            </p>

            {/* Timeout Retry Hint */}
            <AnimatePresence>
              {showTimeoutHelp && onRetry && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-4 flex flex-col items-center gap-2"
                >
                  <span className="text-[11px] text-[#FAF7F0]/60">
                    استغرق التحميل وقتاً أطول من المعتاد؟
                  </span>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25493D] hover:bg-[#2E584A] text-[#E8D5A8] border border-[#C7B895]/50 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة محاولة التحميل الآن</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-rose-950/60 border border-rose-500/40 p-4 rounded-2xl flex flex-col items-center gap-3 text-center"
          >
            <AlertCircle className="w-6 h-6 text-rose-400" />
            <div className="text-xs text-rose-200">
              <p className="font-bold text-rose-100 mb-1">تعذر تحميل البيانات الحالية</p>
              <p className="text-[11px] text-rose-300/80">{error}</p>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF7F0] hover:bg-white text-[#1D3A30] text-xs font-extrabold transition active:scale-95 cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة من جديد</span>
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Footer Branding Token */}
      <div className="absolute bottom-4 text-center text-[10px] text-[#C7B895]/60 tracking-wider">
        نظام نَسْجَة السحابي • النسخة الرابعة v4.0.0
      </div>
    </div>
  );
}
