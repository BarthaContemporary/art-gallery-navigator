
// Modify the DocumentsHeader component to match the Dashboard style
export function DocumentsHeader() {
  return <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl tracking-wide text-slate-500 font-thin">DOCUMENTS</h1>
      </div>
      <UploadDocumentDialog />
    </div>;
}
