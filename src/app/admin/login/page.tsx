import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/admin/LoginForm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ingresar', robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await getSession()) redirect('/admin');
  const { expired } = await searchParams;
  return <LoginForm expired={expired === '1'} />;
}
