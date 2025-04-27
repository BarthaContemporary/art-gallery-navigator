
import { FileUploader } from "@/components/uploads/FileUploader";

export default function Upload() {
  return (
    <div className="container max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Upload Files</h1>
      <div className="bg-card rounded-lg shadow">
        <FileUploader />
      </div>
    </div>
  );
}
