
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useArtists } from "@/hooks/useArtists";
import { useArtworks } from "@/hooks/use-artworks";
import { useCollections } from "@/hooks/use-collections";
import { useDocuments } from "@/hooks/use-documents";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface Reference {
  type: 'document' | 'collection' | 'artwork' | 'artist';
  id: string;
  name: string;
}

interface ReferenceSelectorProps {
  onReferencesChange: (references: { type: 'document' | 'collection' | 'artwork' | 'artist', id: string }[]) => void;
}

export function ReferenceSelector({ onReferencesChange }: ReferenceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReferences, setSelectedReferences] = useState<Reference[]>([]);
  
  // Fetch data from all reference types
  const { data: artists, isLoading: artistsLoading } = useArtists();
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: artworks, isLoading: artworksLoading } = useArtworks();
  const { data: documents, isLoading: documentsLoading } = useDocuments();
  
  // Filter data based on search term
  const filteredArtists = artists?.filter(a => 
    a.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  const filteredCollections = collections?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  const filteredArtworks = artworks?.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  const filteredDocuments = documents?.filter(d => 
    d.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  const handleAddReference = (ref: Reference) => {
    // Check if already selected
    if (!selectedReferences.find(r => r.id === ref.id && r.type === ref.type)) {
      const newReferences = [...selectedReferences, ref];
      setSelectedReferences(newReferences);
      
      // Notify parent component
      onReferencesChange(newReferences.map(r => ({ type: r.type, id: r.id })));
    }
  };
  
  const handleRemoveReference = (ref: Reference) => {
    const newReferences = selectedReferences.filter(
      r => !(r.id === ref.id && r.type === ref.type)
    );
    setSelectedReferences(newReferences);
    
    // Notify parent component
    onReferencesChange(newReferences.map(r => ({ type: r.type, id: r.id })));
  };
  
  return (
    <div className="space-y-4">
      {/* Selected references display */}
      {selectedReferences.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedReferences.map(ref => (
            <Badge key={`${ref.type}-${ref.id}`} variant="secondary" className="flex items-center gap-1">
              {ref.type}: {ref.name}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => handleRemoveReference(ref)}
              />
            </Badge>
          ))}
        </div>
      )}
      
      <Input
        placeholder="Search references..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-2"
      />
      
      <Tabs defaultValue="artworks">
        <TabsList className="grid grid-cols-4 mb-2">
          <TabsTrigger value="artworks">Artworks</TabsTrigger>
          <TabsTrigger value="artists">Artists</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        
        <TabsContent value="artworks" className="max-h-48 overflow-y-auto">
          {artworksLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Loading artworks...</div>
          ) : filteredArtworks.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No artworks found</div>
          ) : (
            <div className="space-y-1">
              {filteredArtworks.map(artwork => (
                <div key={artwork.id} className="flex justify-between items-center p-2 hover:bg-muted rounded-md">
                  <div className="text-sm truncate">{artwork.title}</div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleAddReference({ type: 'artwork', id: artwork.id, name: artwork.title })}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="artists" className="max-h-48 overflow-y-auto">
          {artistsLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Loading artists...</div>
          ) : filteredArtists.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No artists found</div>
          ) : (
            <div className="space-y-1">
              {filteredArtists.map(artist => (
                <div key={artist.id} className="flex justify-between items-center p-2 hover:bg-muted rounded-md">
                  <div className="text-sm truncate">{artist.full_name}</div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleAddReference({ type: 'artist', id: artist.id, name: artist.full_name })}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="collections" className="max-h-48 overflow-y-auto">
          {collectionsLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Loading collections...</div>
          ) : filteredCollections.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No collections found</div>
          ) : (
            <div className="space-y-1">
              {filteredCollections.map(collection => (
                <div key={collection.id} className="flex justify-between items-center p-2 hover:bg-muted rounded-md">
                  <div className="text-sm truncate">{collection.name}</div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleAddReference({ type: 'collection', id: collection.id, name: collection.name })}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="documents" className="max-h-48 overflow-y-auto">
          {documentsLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Loading documents...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No documents found</div>
          ) : (
            <div className="space-y-1">
              {filteredDocuments.map(document => (
                <div key={document.id} className="flex justify-between items-center p-2 hover:bg-muted rounded-md">
                  <div className="text-sm truncate">{document.file_name}</div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleAddReference({ type: 'document', id: document.id, name: document.file_name })}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
