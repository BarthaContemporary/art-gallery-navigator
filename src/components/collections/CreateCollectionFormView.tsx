import React from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArtworkSearch } from "./ArtworkSearch";
import { Artwork } from "@/hooks/use-artworks";
import { X } from "lucide-react";
interface CreateCollectionFormViewProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  artworks: Artwork[];
  artworksLoading: boolean;
  selectedArtworks: string[];
  onToggleArtwork: (id: string) => void;
  emails: string[];
  currentEmail: string;
  onCurrentEmailChange: (value: string) => void;
  onAddEmail: () => void;
  onRemoveEmail: (email: string) => void;
}
export function CreateCollectionFormView({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  artworks,
  artworksLoading,
  selectedArtworks,
  onToggleArtwork,
  emails,
  currentEmail,
  onCurrentEmailChange,
  onAddEmail,
  onRemoveEmail
}: CreateCollectionFormViewProps) {
  return <div className="space-y-4 py-2 px-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <Input value={name} onChange={e => onNameChange(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Textarea value={description} onChange={e => onDescriptionChange(e.target.value)} />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Select Artworks</p>
        {artworksLoading ? <span className="text-xs text-muted-foreground">Loading artworks…</span> : <ArtworkSearch artworks={artworks || []} selectedArtworks={selectedArtworks} onToggleArtwork={onToggleArtwork} />}
      </div>
      <div>
        
        
        {emails.length > 0 && <div className="flex flex-wrap gap-2 mt-2">
            {emails.map(email => <div key={email} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                <span className="text-sm">{email}</span>
                <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => onRemoveEmail(email)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>)}
          </div>}
      </div>
    </div>;
}