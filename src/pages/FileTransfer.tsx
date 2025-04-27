import { FileUploader } from "@/components/uploads/FileUploader";
export default function FileTransfer() {
  return <div className="container max-w-4xl mx-auto py-8">
      <h1 className="tracking-wide text-slate-500 text-3xl font-thin">FILE TRANSFER</h1>
      <div className="bg-card rounded-lg shadow">
        <FileUploader />
      </div>
    </div>;
}