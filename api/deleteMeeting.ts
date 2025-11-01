import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../src/lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).send('Method Not Allowed');
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { id } = body || {};
  if (!id) return res.status(400).json({ error: 'Invalid payload' });
  const { error } = await supabaseServer.from('branch_meetings').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}

