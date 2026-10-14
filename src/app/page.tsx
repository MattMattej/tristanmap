import type { Metadata } from 'next';
import PublicApp from '@/components/public/PublicApp';
import { getPublicSnapshot } from '@/lib/snapshot';

// Se renderiza por request, pero los datos salen del caché (ver lib/snapshot).
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ p?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const data = await getPublicSnapshot();
  const { p } = await searchParams;
  const feature = typeof p === 'string' ? data.features.find((f) => f.id === p) : undefined;
  const title = feature?.title || data.settings.title;
  const description = feature?.description?.slice(0, 180) || data.settings.subtitle;
  return {
    title: { absolute: feature ? `${title} · ${data.settings.title}` : title },
    description,
    openGraph: { title, description, images: feature?.photo ? [feature.photo.url] : undefined },
  };
}

export default async function Home({ searchParams }: Props) {
  const data = await getPublicSnapshot();
  const { p } = await searchParams;
  return <PublicApp data={data} initialSelectedId={typeof p === 'string' ? p : null} />;
}
