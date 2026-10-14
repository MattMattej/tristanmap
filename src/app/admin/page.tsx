import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Editor from '@/components/admin/Editor';
import { getSession } from '@/lib/auth';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Estudio', robots: { index: false, follow: false } };

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const store = getStore();
  const data = await store.readAll();
  return <Editor initialData={data} driver={store.driver} ephemeral={store.ephemeral} username={session.username} />;
}
