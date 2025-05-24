
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PDFTemplateControlsProps {
  type: "artwork" | "collection";
  useStationery: boolean;
  onStationeryChange: (checked: boolean) => void;
  selectedTemplate?: string; // Optional, for collections
  onTemplateChange?: (template: string) => void; // Optional, for collections
}

export function PDFTemplateControls({
  type,
  useStationery,
  onStationeryChange,
  selectedTemplate,
  onTemplateChange,
}: PDFTemplateControlsProps) {
  const showTemplateTabs = type === "collection" && selectedTemplate && onTemplateChange;
  // For artworks, stationery is always on and not user-toggleable in this UI.
  const allowStationeryToggle = type === "collection";

  return (
    <div className="space-y-6">
      {/* Stationery Toggle (only for collections, or if artworks could optionally disable it) */}
      {allowStationeryToggle && (
        <div className="space-y-2">
          <h3 className="text-md font-semibold">Document Options</h3>
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <Label htmlFor="stationery-mode" className="flex flex-col space-y-1">
              <span>Use Company Stationery</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Apply official letterhead to the document.
              </span>
            </Label>
            <Switch
              id="stationery-mode"
              checked={useStationery}
              onCheckedChange={onStationeryChange}
              aria-label="Toggle company stationery"
            />
          </div>
        </div>
      )}
      {/* If artworks must always use stationery and it's not toggleable: */}
      {type === "artwork" && (
         <div className="space-y-2">
          <h3 className="text-md font-semibold">Document Options</h3>
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/30">
            <Label htmlFor="stationery-mode" className="flex flex-col space-y-1">
              <span>Use Company Stationery</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Artwork PDFs always use company stationery.
              </span>
            </Label>
            <Switch
              id="stationery-mode"
              checked={true}
              disabled={true} 
              aria-label="Company stationery enabled for artworks"
            />
          </div>
        </div>
      )}


      {/* Template Selection (only for collections) */}
      {showTemplateTabs && (
        <div className="space-y-2">
          <h3 className="text-md font-semibold">Template Style (Collections)</h3>
          <Tabs value={selectedTemplate} onValueChange={onTemplateChange} className="w-full">
            <TabsList className="grid w-full grid-cols-1"> {/* Simplified to 1 column if only one option for collections */}
              {/* Add TabsTrigger for collection templates here if they exist */}
              {/* Example: <TabsTrigger value="collection_list_style">List Style</TabsTrigger> */}
              {/* Example: <TabsTrigger value="collection_grid_style">Grid Style</TabsTrigger> */}
              <TabsTrigger value="collection_default">Default Collection Style</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
    </div>
  );
}
