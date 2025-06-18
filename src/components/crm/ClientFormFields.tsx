
import { BasicInfoFields } from "./form/BasicInfoFields";
import { ContactInfoFields } from "./form/ContactInfoFields";
import { StatusFields } from "./form/StatusFields";
import { AdditionalInfoFields } from "./form/AdditionalInfoFields";
import { ProfileImageField } from "./form/ProfileImageField";
import { ClientFormData } from "./hooks/useCreateClientForm";

interface ClientFormFieldsProps {
  formData: ClientFormData;
  onFormDataChange: (updates: Partial<ClientFormData>) => void;
}

export function ClientFormFields({
  formData,
  onFormDataChange
}: ClientFormFieldsProps) {
  return (
    <>
      <ProfileImageField formData={formData} onFormDataChange={onFormDataChange} />
      <BasicInfoFields formData={formData} onFormDataChange={onFormDataChange} />
      <ContactInfoFields formData={formData} onFormDataChange={onFormDataChange} />
      <StatusFields formData={formData} onFormDataChange={onFormDataChange} />
      <AdditionalInfoFields formData={formData} onFormDataChange={onFormDataChange} />
    </>
  );
}
