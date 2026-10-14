import { NextResponse } from 'next/server';
import { handle, readJson, requireAdmin } from '@/lib/api';
import { settingsSchema } from '@/lib/schemas';
import { invalidatePublicSnapshot } from '@/lib/snapshot';
import { getStore } from '@/lib/store';

export const PUT = handle(async (req: Request) => {
  await requireAdmin(req);
  const settings = settingsSchema.parse(await readJson(req));
  const saved = await getStore().saveSettings(settings);
  invalidatePublicSnapshot();
  return NextResponse.json(saved);
});
