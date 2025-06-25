
import { EnhancedDocument } from "@/hooks/use-enhanced-documents";
import { DocumentCard } from "./DocumentCard";
import { DocumentInfo } from "./DocumentInfo";
import { DocumentActions } from "./DocumentActions";
import { Card, CardContent } from "@/components/ui/card";

interface ResponsiveDocumentCardProps {
  document: EnhancedDocument;
}

export function ResponsiveDocumentCard({ document }: ResponsiveDocumentCardProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <DocumentInfo document={document} />
          </div>
          <div className="flex-shrink-0">
            <DocumentActions document={document} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
