
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface PDFTemplateControlsProps {
  type: "artwork" | "collection";
  useStationery: boolean;
  onStationeryChange: (value: boolean) => void;
}

export function PDFTemplateControls({ 
  type, 
  useStationery, 
  onStationeryChange 
}: PDFTemplateControlsProps) {
  return (
    <>
      {type === "artwork" && (
        <>
          <div className="flex items-center space-x-2 mb-4">
            <Switch
              id="stationery-mode"
              checked={useStationery}
              onCheckedChange={onStationeryChange}
            />
            <Label htmlFor="stationery-mode">Use Company Stationery</Label>
          </div>
          
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="basicWithPrice">Basic with Price</TabsTrigger>
            <TabsTrigger value="complete">Complete</TabsTrigger>
          </TabsList>
        </>
      )}
    </>
  );
}
