
import { FileUploader } from "@/components/uploads/FileUploader";

export default function Upload() {
  return (
    <div className="container max-w-2xl mx-auto py-8">
      <h1 className="text-sm font-visby font-extrabold text-slate-700">UPLOAD FILES</h1>
      <div className="bg-card rounded-lg shadow">
        <FileUploader />
      </div>
    </div>
  );
}
