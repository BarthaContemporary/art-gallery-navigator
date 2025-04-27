import { UploadDocumentDialog } from "./UploadDocumentDialog";
export function DocumentsHeader() {
  return <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl tracking-wide font-semibold text-slate-500">DOCUMENTS</h1>
      </div>
      <UploadDocumentDialog />
    </div>;
}