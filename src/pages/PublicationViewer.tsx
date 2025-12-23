import { useParams } from 'react-router-dom';
import { PublicationReader } from '@/components/publications/PublicationReader';

export default function PublicationViewer() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Publication not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicationReader publicationSlug={slug} />
    </div>
  );
}
