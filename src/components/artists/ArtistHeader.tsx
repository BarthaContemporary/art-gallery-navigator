
import { CreateArtistDialog } from "./CreateArtistDialog";

export const ArtistHeader = () => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Artists</h1>
        <p className="text-muted-foreground">
          Manage represented and non-represented artists
        </p>
      </div>
      <CreateArtistDialog />
    </div>
  );
};
