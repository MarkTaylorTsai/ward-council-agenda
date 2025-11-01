import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../src/lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).send('Method Not Allowed');
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { id, field, value } = body || {};
  if (!id || !field) return res.status(400).json({ error: 'Invalid payload' });
  const { error } = await supabaseServer.from('branch_meetings').update({ [field]: value }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}

