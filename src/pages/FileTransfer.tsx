
import { FileUploader } from "@/components/uploads/FileUploader";

export default function FileTransfer() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-visby text-slate-700 text-sm font-extrabold">FILE TRANSFER</h1>
      </div>
      <div className="max-w-4xl">
        <FileUploader />
      </div>
    </div>
  );
}
