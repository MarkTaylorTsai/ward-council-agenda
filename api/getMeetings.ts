import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../src/lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { data, error } = await supabaseServer
    .from('branch_meetings')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ data });
}

