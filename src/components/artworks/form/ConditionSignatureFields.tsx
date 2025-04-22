
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Pen } from "lucide-react";

interface ConditionSignatureFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
}

export function ConditionSignatureFields({ form }: ConditionSignatureFieldsProps) {
  const signatureType = form.watch('signature_type');

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="condition"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Condition</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Describe the condition of the artwork" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="signature_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Pen className="h-4 w-4" />
              Signature
            </FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select signature type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="not signed">Not signed</SelectItem>
                <SelectItem value="hand-signed by artist">Hand-signed by artist</SelectItem>
                <SelectItem value="signed on plate">Signed on plate</SelectItem>
                <SelectItem value="stamped by artist's estate">Stamped by artist's estate</SelectItem>
                <SelectItem value="sticker label">Sticker label</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {signatureType && signatureType !== 'not signed' && (
        <FormField
          control={form.control}
          name="signature_details"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Provide details about the signature
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter signature details" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
