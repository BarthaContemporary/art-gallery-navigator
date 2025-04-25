
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
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
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  
  // Ensure options is always a valid array
  const safeOptions = Array.isArray(options) ? options : [];
  
  // Ensure value is always a string
  const safeValue = typeof value === 'string' ? value : '_none';
  
  // Get the display value (safely)
  const selectedOption = safeOptions.find((option) => option.value === safeValue);
  
  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <div className="flex items-center">
            {selectedOption?.icon && (
              <selectedOption.icon className="mr-2 h-4 w-4" />
            )}
            {selectedOption ? selectedOption.label : placeholder}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
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
        </Command>
      </PopoverContent>
    </Popover>
  );
}
