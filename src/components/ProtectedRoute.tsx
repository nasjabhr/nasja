import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isUserAuthorized } from '../lib/security';
import { syncWithServer } from '../lib/dataService';

export default function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (!isUserAuthorized(session.user)) {
          // Reject and sign out unauthorized user
          await supabase.auth.signOut();
          setAuthenticated(false);
        } else {
          setAuthenticated(true);
          // Sync cloud data across devices immediately
          syncWithServer().catch(() => {});
        }
      } else {
        setAuthenticated(false);
      }
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        if (!isUserAuthorized(session.user)) {
          await supabase.auth.signOut();
          setAuthenticated(false);
        } else {
          setAuthenticated(true);
          syncWithServer().catch(() => {});
        }
      } else {
        setAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return <Navigate to="/setup" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-300"></div>
      </div>
    );
  }

  return authenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

