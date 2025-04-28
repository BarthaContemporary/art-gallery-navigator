
import { FileUploader } from "@/components/uploads/FileUploader";
import { PageHeader } from "@/components/layout/PageHeader";

export default function FileTransfer() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="FILE TRANSFER" />
      <div className="max-w-4xl">
        <FileUploader />
      </div>
    </div>
  );
}
