import { z } from 'zod';

export const addSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().min(1),
  host: z.string().min(1),
  recorder: z.string().min(1),
  purpose: z.string().min(1),
  opening_prayer: z.string().min(1),
  closing_prayer: z.string().min(1),
});

export type AddPayload = z.infer<typeof addSchema>;

const FIELD_KEYS = [
  'date',
  'time',
  'location',
  'host',
  'recorder',
  'purpose',
  'opening_prayer',
  'closing_prayer',
] as const;

export type UpdatableField = typeof FIELD_KEYS[number];

export function isViewAll(text: string): boolean {
  return /^查看支會議會\s+全部$/u.test(text.trim());
}

export function parseAdd(text: string): AddPayload | null {
  const m = /^新增支會議會\s+(.+)$/u.exec(text.trim());
  if (!m) {
    console.log('parseAdd: Pattern does not match');
    return null;
  }
  const args = smartSplit(m[1]);
  console.log('parseAdd: Split args:', args, 'Count:', args.length);
  if (args.length < 8) {
    console.log('parseAdd: Not enough arguments, need 8, got', args.length);
    return null;
  }
  const payload = {
    date: args[0],
    time: args[1],
    location: args[2],
    host: args[3],
    recorder: args[4],
    purpose: args[5],
    opening_prayer: args[6],
    closing_prayer: args[7],
  };
  console.log('parseAdd: Payload:', payload);
  const parsed = addSchema.safeParse(payload);
  if (!parsed.success) {
    console.log('parseAdd: Validation failed:', parsed.error.errors);
  }
  return parsed.success ? parsed.data : null;
}

export function parseUpdate(text: string): { id: string; field: UpdatableField; value: string } | null {
  const m = /^更新支會議會\s+(.+)$/u.exec(text.trim());
  if (!m) return null;
  const args = smartSplit(m[1]);
  if (args.length < 3) return null;
  const [id, field, ...rest] = args;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return null;
  if (!FIELD_KEYS.includes(field as UpdatableField)) return null;
  const value = rest.join(' ');
  if (!value) return null;
  return { id, field: field as UpdatableField, value };
}

export function parseDelete(text: string): { id: string } | null {
  const m = /^刪除支會議會\s+([0-9a-fA-F-]{36})$/u.exec(text.trim());
  if (!m) return null;
  return { id: m[1] };
}

function smartSplit(input: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(c)) {
      if (buf) {
        out.push(buf);
        buf = '';
      }
    } else {
      buf += c;
    }
  }
  if (buf) out.push(buf);
  return out;
}

