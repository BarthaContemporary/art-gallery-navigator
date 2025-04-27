
import { FileUploader } from "@/components/uploads/FileUploader";

export default function FileTransfer() {
  return (
    <div className="container max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">File Transfer</h1>
      <div className="bg-card rounded-lg shadow">
        <FileUploader />
      </div>
    </div>
  );
}
