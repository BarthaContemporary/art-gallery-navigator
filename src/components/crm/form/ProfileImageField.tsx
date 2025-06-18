
import { Label } from "@/components/ui/label";
import { ClientProfileImage } from "../ClientProfileImage";
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
      <Label>Profile Image</Label>
      <div className="flex items-center gap-4">
        <ClientProfileImage
          fullName={formData.full_name || "New Client"}
          email={formData.email}
          profileImageUrl={formData.profile_image_url}
          size="lg"
          editable={true}
          onImageUpdate={handleImageUpdate}
        />
        <div className="text-sm text-muted-foreground">
          <p>Upload a profile image or one will be generated automatically.</p>
          <p>If an email is provided, we'll check for a Gravatar image.</p>
        </div>
      </div>
    </div>
  );
}
