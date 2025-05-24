
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
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
  triggerClassName?: string;
  triggerVariant?: VariantProps<typeof buttonVariants>['variant'];
  triggerSize?: VariantProps<typeof buttonVariants>['size'];
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
  
  const safeOptions = Array.isArray(options) ? options : [];
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
          // Removed "w-full" to allow intrinsic width, removed "justify-start" to use default "justify-center" from buttonVariants
          className={cn(triggerClassName)} 
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
      {/* Changed PopoverContent width from w-full to w-56 (224px) to match TypeFilter dropdown width */}
      <PopoverContent className="w-56 p-0">
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

