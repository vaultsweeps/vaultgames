import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Polyfill WebSocket for Node.js < 22 (required by @supabase/realtime-js)
if (!globalThis.WebSocket) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (globalThis as any).WebSocket = require('ws');
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase URL or Service Key not found. Realtime features will not work.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'placeholder', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
