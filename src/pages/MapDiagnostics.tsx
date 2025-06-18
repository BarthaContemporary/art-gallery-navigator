
import { MapDiagnosticsAI } from "@/components/crm/MapDiagnosticsAI";

export default function MapDiagnostics() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Map Implementation Diagnostics</h1>
        <p className="text-muted-foreground mt-2">
          AI-powered analysis of Google Maps integration issues
        </p>
      </div>
      
      <MapDiagnosticsAI />
    </div>
  );
}
