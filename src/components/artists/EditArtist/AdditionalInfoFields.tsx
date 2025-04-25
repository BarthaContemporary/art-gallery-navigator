
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UseFormRegister } from "react-hook-form";
import { EditArtistForm } from "@/hooks/use-edit-artist-form";

interface AdditionalInfoFieldsProps {
  register: UseFormRegister<EditArtistForm>;
  statusOptions: { label: string; value: string }[];
}

export function AdditionalInfoFields({ register, statusOptions }: AdditionalInfoFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="nationality">Nationality</Label>
        <Input
          id="nationality"
          {...register("nationality")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="biography">Biography</Label>
        <Textarea
          id="biography"
          {...register("biography")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="representation_status">Representation Status</Label>
        <select
          id="representation_status"
          className="w-full border px-3 py-2 rounded text-gray-900"
          {...register("representation_status")}
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </>
  );
}
