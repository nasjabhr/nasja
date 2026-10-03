import { useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isUserAuthorized } from '../lib/security';
import { syncWithServer, isCloudDataReady } from '../lib/dataService';
import SplashScreen from './SplashScreen';

export default function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [statusText, setStatusText] = useState('جارِ تهيئة النظام والتحقق من الصلاحيات...');
  const [loadError, setLoadError] = useState<string | null>(null);

  const initSessionAndLoadData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    setLoadError(null);
    setStatusText('جارِ التحقق من الجلسة وصلاحيات الإدارة...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      if (!isUserAuthorized(session.user)) {
        await supabase.auth.signOut();
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      setAuthenticated(true);
      setStatusText('جارِ تحميل كافة بيانات نَسْجَة من قاعدة البيانات السحابية...');

      // Crucial requirement: DO NOT let the person enter the website until ALL data is loaded
      await syncWithServer(true);

      // Verify that cloud data is ready in memory
      if (isCloudDataReady()) {
        setStatusText('تم تحميل البيانات بنجاح، مرحباً بك في نَسْجَة');
        // Brief smooth pause so the transition feels premium
        setTimeout(() => {
          setLoading(false);
        }, 300);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[nasjah] Failed to load initial data:', err);
      // Even if an error happens, allow retry or fallback
      setLoadError(err?.message || 'تعذر الاتصال بقاعدة البيانات السحابية');
    }
  }, []);

  useEffect(() => {
    initSessionAndLoadData();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setAuthenticated(false);
          setLoading(false);
        } else if (event === 'SIGNED_IN' && session) {
          if (!isUserAuthorized(session.user)) {
            await supabase.auth.signOut();
            setAuthenticated(false);
            setLoading(false);
          } else {
            setAuthenticated(true);
            await syncWithServer(true).catch(() => {});
            setLoading(false);
          }
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [initSessionAndLoadData]);

  if (!isSupabaseConfigured) {
    return <Navigate to="/setup" replace />;
  }

  // Display the royal splash screen until authentication AND all data are fully loaded from the database
  if (loading) {
    return (
      <SplashScreen
        statusText={statusText}
        error={loadError}
        onRetry={initSessionAndLoadData}
        subTitle="أقمشة وخياطة راقية • مملكة البحرين"
      />
    );
  }

  return authenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
