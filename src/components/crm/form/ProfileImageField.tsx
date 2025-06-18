
import { ClientFormData } from "../hooks/useCreateClientForm";

interface ProfileImageFieldProps {
  formData: ClientFormData;
  onFormDataChange: (updates: Partial<ClientFormData>) => void;
}

export function ProfileImageField({ formData, onFormDataChange }: ProfileImageFieldProps) {
  const handleImageUpdate = (imageUrl: string) => {
    onFormDataChange({ profile_image_url: imageUrl });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
      </div>
    </div>
  );
}
