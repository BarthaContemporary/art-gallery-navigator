
import { Calendar } from "lucide-react";
import { formatDate, getDocumentTypeInfo } from "./utils/document-utils";

interface DocumentInfoProps {
  type: string;
  fileName: string;
  dateUploaded: string;
  description?: string | null;
}

export function DocumentInfo({ type, fileName, dateUploaded, description }: DocumentInfoProps) {
  const { color } = getDocumentTypeInfo(type);
  
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-1 rounded-full capitalize ${color}`}>
          {type === "artwork_overview" ? "Artwork Overview" : type}
        </span>
      </div>
      <h3 className="font-semibold">{fileName}</h3>
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Uploaded on {formatDate(dateUploaded)}
        </span>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
