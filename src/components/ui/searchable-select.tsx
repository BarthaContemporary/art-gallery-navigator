import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button"; // Import buttonVariants
import type { VariantProps } from "class-variance-authority"; // Import VariantProps
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Option {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  triggerClassName?: string; // New prop for custom class on trigger
  triggerVariant?: VariantProps<typeof buttonVariants>['variant']; // New prop for trigger variant
  triggerSize?: VariantProps<typeof buttonVariants>['size']; // New prop for trigger size
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  icon,
  triggerClassName, 
  triggerVariant,   
  triggerSize,      
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  // console.log("SearchableSelect options:", options);
  // console.log("SearchableSelect value:", value);
  
  const safeOptions = Array.isArray(options) ? options : [];
  // console.log("SearchableSelect safeOptions:", safeOptions);
  
  const safeValue = typeof value === 'string' ? value : '_none';
  
  const selectedOption = safeOptions.find((option) => option.value === safeValue);
  
  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={triggerVariant || "outline"} 
          size={triggerSize || "default"}     
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-start", triggerClassName)} // Changed justify-between to justify-start
          disabled={disabled}
        >
          <div className="flex items-center">
            {icon}
            {selectedOption?.icon && (
              <selectedOption.icon className="mr-2 h-4 w-4" />
            )}
            {selectedOption ? selectedOption.label : placeholder}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="_none"
                value="_none"
                onSelect={() => {
                  onChange("_none");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    safeValue === "_none" ? "opacity-100" : "opacity-0"
                  )}
                />
                None
              </CommandItem>
              {safeOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      safeValue === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.icon && <option.icon className="mr-2 h-4 w-4" />}
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
