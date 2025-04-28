import { FileUploader } from "@/components/uploads/FileUploader";
export default function FileTransfer() {
  return <div className="container max-w-4xl mx-auto py-8">
      <h1 className="text-sm font-visby font-extrabold text-slate-700">FILE TRANSFER</h1>
      <div className="bg-card rounded-lg shadow">
        <FileUploader />
      </div>
    </div>;
}
