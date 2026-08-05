import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl?.trim()) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL. Add it to your .env file (project root, no /rest/v1 suffix).',
  );
}

if (!supabaseAnonKey?.trim()) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Add it to your .env file.',
  );
}

export const supabase = createClient<Database>(supabaseUrl.trim(), supabaseAnonKey.trim(), {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
