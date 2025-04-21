
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";

interface PricingFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
}

export function PricingFields({ form }: PricingFieldsProps) {
  return (
    <div className="flex gap-4">
      <FormField
        control={form.control}
        name="price"
        render={({ field }) => (
          <FormItem className="flex-1">
            <FormLabel>Price</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="currency"
        rules={{ required: "Currency is required" }}
        render={({ field }) => (
          <FormItem className="w-32">
            <FormLabel>Currency</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {['USD', 'EUR', 'GBP', 'CHF'].map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
