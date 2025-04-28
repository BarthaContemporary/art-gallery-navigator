
import { UploadDocumentDialog } from "./UploadDocumentDialog";

export function DocumentsHeader() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl tracking-wide font-semibold text-slate-500">DOCUMENTS</h1>
      <div className="flex justify-end">
        <UploadDocumentDialog />
      </div>
    </div>
  );
}
