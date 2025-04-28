
import { FileUploader } from "@/components/uploads/FileUploader";

export default function FileTransfer() {
  return (
    <div className="px-6 py-8">
      <h1 className="text-sm font-visby font-extrabold text-slate-700 mb-6">FILE TRANSFER</h1>
      <div className="max-w-4xl">
        <FileUploader />
      </div>
    </div>
  );
}
