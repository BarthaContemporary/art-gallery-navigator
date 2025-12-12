import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, X } from 'lucide-react';
import { useAddressValidation } from '@/hooks/crm/use-address-validation';
import { cn } from '@/lib/utils';

interface LocationAddressInputProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

export function LocationAddressInput({ value, onChange, placeholder = "Start typing an address...", className }: LocationAddressInputProps) {
  const [searchInput, setSearchInput] = useState(value || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { suggestions, isLoading, fetchSuggestions, getPlaceDetails, clearSuggestions } = useAddressValidation();

  // Sync with external value changes
  useEffect(() => {
    if (value !== searchInput) {
      setSearchInput(value || '');
    }
  }, [value]);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchInput(newValue);
    onChange(newValue);
    setShowSuggestions(true);

    // Debounce API calls
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
    setDebounceTimer(timer);
  };

  const handleSuggestionSelect = async (placeId: string) => {
    const details = await getPlaceDetails(placeId);
    if (details) {
      const formattedAddress = details.formatted_address;
      setSearchInput(formattedAddress);
      onChange(formattedAddress);
    }
    setShowSuggestions(false);
    clearSuggestions();
  };

  const handleClear = () => {
    setSearchInput('');
    onChange('');
    clearSuggestions();
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={handleInputChange}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          className="pl-9 pr-16"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {searchInput && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-start gap-2"
              onClick={() => handleSuggestionSelect(suggestion.place_id)}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>{suggestion.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
