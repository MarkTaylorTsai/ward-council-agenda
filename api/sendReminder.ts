import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../src/lib/supabase.js';
import { formatReminder } from '../src/lib/format.js';
import { pushText, broadcastText } from '../src/lib/line.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {

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

  // Broadcast to all users who have added the bot as a friend
  try {
    await broadcastText(text);
  } catch (error: any) {
    // broadcastMessage requires Messaging API plan - log error but continue
    console.error('Broadcast failed (may require Messaging API plan):', error?.message);
  }

  // Push to all groups the bot is in
  const { data: groups, error: groupsError } = await supabaseServer
    .from('line_contacts')
    .select('contact_id')
    .eq('contact_type', 'group');

  if (groupsError) {
    console.error('Failed to fetch groups:', groupsError.message);
  } else if (groups && groups.length > 0) {
    // Send to all groups in parallel
    await Promise.allSettled(
      groups.map((group) => pushText(group.contact_id, text).catch((err) => {
        console.error(`Failed to send to group ${group.contact_id}:`, err?.message);
        return null;
      }))
    );
  }

  res.status(200).json({
    ok: true,
    count: data?.length || 0,
    groups: groups?.length || 0,
    broadcast: true,
  });
}

