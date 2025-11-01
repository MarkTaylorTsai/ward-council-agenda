import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../src/lib/supabase';
import { addSchema } from '../src/lib/parser';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const parsed = addSchema.safeParse(payload);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { data, error } = await supabaseServer.from('branch_meetings').insert(parsed.data).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ data });
}

