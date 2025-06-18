
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
          linkedinHandle={formData.linkedin_handle}
          instagramHandle={formData.instagram_handle}
          size="lg"
          editable={true}
          onImageUpdate={handleImageUpdate}
        />
      </div>
    </div>
  );
}
