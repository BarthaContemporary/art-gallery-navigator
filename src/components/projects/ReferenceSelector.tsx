
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Reference } from "./reference-selector/types"; // Updated import
import { useReferenceData } from "./reference-selector/useReferenceData"; // New hook
import { SelectedReferencesDisplay } from "./reference-selector/SelectedReferencesDisplay"; // New component
import { ReferenceList } from "./reference-selector/ReferenceList"; // New component

interface ReferenceSelectorProps {
  onReferencesChange: (references: { type: Reference['type'], id: string }[]) => void;
  initialReferences?: Reference[];
}

export function ReferenceSelector({ onReferencesChange, initialReferences = [] }: ReferenceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReferences, setSelectedReferences] = useState<Reference[]>([]);
  
  const {
    artists,
    collections,
    artworks,
    documents,
  } = useReferenceData(searchTerm);

  useEffect(() => {
    if (initialReferences && initialReferences.length > 0) {
      // Ensure initialReferences are not duplicated if component re-renders with same initial props
      // This logic assumes initialReferences itself doesn't change frequently for the same instance
      // or that if it does, it represents the new source of truth for selected items.
      // A more robust solution might involve comparing with current selectedReferences
      // if partial updates to initialReferences were possible and needed merging.
      setSelectedReferences(initialReferences);
    } else if (initialReferences.length === 0 && selectedReferences.length > 0 && searchTerm === '') {
      // This case might be if initialReferences was cleared, then local state should also clear.
      // However, typically initialReferences are set once. If not, this logic might need adjustment.
      // For now, only set from initialReferences if it's provided.
    }
  }, [initialReferences]); // Only re-run if initialReferences prop itself changes.
  
  const handleAddReference = (ref: Reference) => {
    if (!selectedReferences.find(r => r.id === ref.id && r.type === ref.type)) {
      const newReferences = [...selectedReferences, ref];
      setSelectedReferences(newReferences);
      onReferencesChange(newReferences.map(r => ({ type: r.type, id: r.id })));
    }
  };
  
  const handleRemoveReference = (ref: Reference) => {
    const newReferences = selectedReferences.filter(
      r => !(r.id === ref.id && r.type === ref.type)
    );
    setSelectedReferences(newReferences);
    onReferencesChange(newReferences.map(r => ({ type: r.type, id: r.id })));
  };
  
  return (
    <div className="space-y-4">
      <SelectedReferencesDisplay 
        selectedReferences={selectedReferences}
        onRemoveReference={handleRemoveReference}
      />
      
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
          <ReferenceList
            items={artworks.data}
            nameKey="title"
            isLoading={artworks.isLoading}
            itemType="artwork"
            onAddReference={handleAddReference}
            loadingMessage="Loading artworks..."
            noItemsMessage="No artworks found"
          />
        </TabsContent>
        
        <TabsContent value="artists" className="max-h-48 overflow-y-auto">
          <ReferenceList
            items={artists.data}
            nameKey="full_name"
            isLoading={artists.isLoading}
            itemType="artist"
            onAddReference={handleAddReference}
            loadingMessage="Loading artists..."
            noItemsMessage="No artists found"
          />
        </TabsContent>
        
        <TabsContent value="collections" className="max-h-48 overflow-y-auto">
          <ReferenceList
            items={collections.data}
            nameKey="name"
            isLoading={collections.isLoading}
            itemType="collection"
            onAddReference={handleAddReference}
            loadingMessage="Loading collections..."
            noItemsMessage="No collections found"
          />
        </TabsContent>
        
        <TabsContent value="documents" className="max-h-48 overflow-y-auto">
          <ReferenceList
            items={documents.data}
            nameKey="file_name"
            isLoading={documents.isLoading}
            itemType="document"
            onAddReference={handleAddReference}
            loadingMessage="Loading documents..."
            noItemsMessage="No documents found"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
