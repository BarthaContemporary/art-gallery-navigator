
import React from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArtworkSearch } from "./ArtworkSearch";
import { Artwork } from "@/hooks/use-artworks";
import { X } from "lucide-react";

interface EditCollectionFormViewProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  artworks: Artwork[] | undefined; // Can be undefined while loading
  artworksLoading: boolean;
  selectedArtworks: string[];
  onToggleArtwork: (id: string) => void;
  emails: string[];
  currentEmail: string;
  onCurrentEmailChange: (value: string) => void;
  onAddEmail: () => void;
  onRemoveEmail: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function EditCollectionFormView({
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
  onRemoveEmail,
  onSubmit,
}: EditCollectionFormViewProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="name_edit_collection_view">Name</Label>
        <Input
          id="name_edit_collection_view" // Ensure unique ID
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description_edit_collection_view">Description</Label>
        <Textarea
          id="description_edit_collection_view" // Ensure unique ID
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
        />
      </div>
      <div>
        <Label>Artworks</Label>
        {artworksLoading ? (
          <span className="text-xs text-muted-foreground">Loading artworks…</span>
        ) : (
          <ArtworkSearch
            artworks={artworks || []}
            selectedArtworks={selectedArtworks}
            onToggleArtwork={onToggleArtwork}
          />
        )}
      </div>
      <div>
        <Label htmlFor="email_edit_collection_view">External Users (Optional)</Label>
        <div className="flex gap-2 mb-2">
          <Input
            id="email_edit_collection_view" // Ensure unique ID
            type="email"
            value={currentEmail}
            onChange={(e) => onCurrentEmailChange(e.target.value)}
            placeholder="Enter email address"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddEmail();
              }
            }}
          />
          <Button type="button" onClick={onAddEmail} variant="secondary">
            Add
          </Button>
        </div>
        {emails.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {emails.map((email) => (
              <div key={email} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                <span className="text-sm">{email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={() => onRemoveEmail(email)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
