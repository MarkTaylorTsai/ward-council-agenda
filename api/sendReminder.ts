import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../src/lib/supabase';
import { formatReminder } from '../src/lib/format';
import { pushText } from '../src/lib/line';

function isAuthorized(req: VercelRequest): boolean {
  const token = req.query.token || req.headers['x-cron-token'];
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && token && String(token) === expected);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) return res.status(401).send('Unauthorized');

  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { data, error } = await supabaseServer
    .from('branch_meetings')
    .select('*')
    .gte('date', startStr)
    .lt('date', endStr)
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const text = formatReminder(data || []);
  const groupId = process.env.REMINDER_GROUP_ID || '';
  const userId = process.env.REMINDER_USER_ID || '';
  const target = groupId || userId;
  if (!target) return res.status(400).json({ error: 'No REMINDER_GROUP_ID or REMINDER_USER_ID configured' });

  await pushText(target, text);
  res.status(200).json({ ok: true, count: data?.length || 0 });
}

