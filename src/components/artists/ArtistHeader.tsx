
import React from 'react';

export const ArtistHeader = () => {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-3xl font-bold tracking-tight">Artists</h1>
      <p className="text-muted-foreground">
        Manage represented and non-represented artists
      </p>
    </div>
  );
};
