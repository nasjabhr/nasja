import { createClient } from '@supabase/supabase-js';

// Force hardcoded values to prevent overriding from malformed AI Studio Secrets
const supabaseUrl = 'https://rpjozutuzdfoszqfogko.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwam96dXR1emRmb3N6cWZvZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzYwMDQsImV4cCI6MjEwNDA1MjAwNH0.FjsZgQQLRaVGGUmspfg2SyvpZsL4mYp4GQHQoHJ56JI';

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  },
});
