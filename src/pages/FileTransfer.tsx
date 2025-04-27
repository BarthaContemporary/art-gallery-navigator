import { FileUploader } from "@/components/uploads/FileUploader";
export default function FileTransfer() {
  return <div className="container max-w-4xl mx-auto py-8">
      <h1 className="text-3xl tracking-wide font-semibold text-slate-500">FILE TRANSFER</h1>
      <div className="bg-card rounded-lg shadow">
        <FileUploader />
      </div>
    </div>;
}