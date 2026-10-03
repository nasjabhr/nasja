import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, X, RefreshCw } from 'lucide-react';
import { EVENT_SYNC_STATUS, getSyncStatus, syncWithServer, type SyncStatus } from '../lib/dataService';

/**
 * Surfaces backend sync problems to the founders instead of hiding them.
 * - Red banner: a save/load failed (the screen was rolled back to what is really in the database).
 * - Amber banner: backend is running without the service role key (maximum security not yet active).
 */
export default function SyncStatusBanner() {
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus());
  const [dismissedAt, setDismissedAt] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const onStatus = (e: Event) => setStatus((e as CustomEvent<SyncStatus>).detail || getSyncStatus());
    window.addEventListener(EVENT_SYNC_STATUS, onStatus);
    return () => window.removeEventListener(EVENT_SYNC_STATUS, onStatus);
  }, []);

  const showError = Boolean(status.lastError) && status.lastErrorAt > dismissedAt;

  const retry = async () => {
    setRetrying(true);
    await syncWithServer(true);
    setRetrying(false);
  };

  if (!showError && status.mode !== 'user-jwt') return null;

  return (
    <div className="fixed top-2 inset-x-2 z-[100] flex flex-col gap-2 pointer-events-none" dir="rtl">
      {showError && (
        <div className="pointer-events-auto mx-auto w-full max-w-xl rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 shadow-lg px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 text-xs leading-relaxed">
            <p className="font-bold mb-0.5">لم يتم الحفظ في قاعدة البيانات</p>
            <p className="break-words">{status.lastError}</p>
            <p className="mt-1 text-rose-700/80">تم إرجاع الشاشة إلى البيانات المحفوظة فعلياً. أعد المحاولة بعد التأكد من الاتصال.</p>
          </div>
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="p-1.5 rounded-lg hover:bg-rose-100 cursor-pointer"
            aria-label="إعادة تحميل البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setDismissedAt(Date.now())}
            className="p-1.5 rounded-lg hover:bg-rose-100 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {status.mode === 'user-jwt' && (
        <div className="pointer-events-auto mx-auto w-full max-w-xl rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 shadow px-4 py-2 flex items-center gap-2 text-[11px]">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
          <span>الحماية القصوى غير مفعّلة بعد: يجب إضافة مفتاح SUPABASE_SERVICE_ROLE_KEY في إعدادات Vercel.</span>
        </div>
      )}
    </div>
  );
}
