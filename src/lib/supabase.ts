import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  // Intentionally not throwing to keep serverless cold starts lighter; handlers should guard where needed
  console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type BranchMeeting = {
  id: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss or HH:mm
  location: string;
  host: string;
  recorder: string;
  purpose: string;
  opening_prayer: string;
  closing_prayer: string;
  created_at: string;
  updated_at: string;
};

