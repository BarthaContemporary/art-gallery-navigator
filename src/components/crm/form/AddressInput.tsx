import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAddressValidation, ParsedAddress } from '@/hooks/crm/use-address-validation';
import { cn } from '@/lib/utils';

interface AddressData {
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface AddressInputProps {
  value: AddressData;
  onChange: (address: AddressData) => void;
  className?: string;
}

export function AddressInput({ value, onChange, className }: AddressInputProps) {
  const [searchInput, setSearchInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showManualFields, setShowManualFields] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { suggestions, isLoading, fetchSuggestions, getPlaceDetails, clearSuggestions } = useAddressValidation();

  // Build display string from address components
  const displayAddress = [
    value.address_line1,
    value.address_line2,
    value.city,
    value.state,
    value.postal_code,
    value.country,
  ].filter(Boolean).join(', ');

  // Initialize search input with existing address
  useEffect(() => {
    if (displayAddress && !searchInput) {
      setSearchInput(displayAddress);
    }
  }, []);

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
      onChange({
        address_line1: details.address_line1,
        address_line2: details.address_line2,
        city: details.city,
        state: details.state,
        postal_code: details.postal_code,
        country: details.country,
      });
      setSearchInput(details.formatted_address);
    }
    setShowSuggestions(false);
    clearSuggestions();
  };

  const handleClear = () => {
    setSearchInput('');
    onChange({
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
    });
    clearSuggestions();
  };

  const handleManualFieldChange = (field: keyof AddressData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div ref={wrapperRef} className={cn('space-y-3', className)}>
      {/* Search Input */}
      <div className="relative">
        <Label className="text-xs text-muted-foreground mb-1 block">Address</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Start typing an address..."
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

      {/* Toggle Manual Fields */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground h-auto py-1 px-0 hover:bg-transparent"
        onClick={() => setShowManualFields(!showManualFields)}
      >
        {showManualFields ? (
          <>
            <ChevronUp className="h-3 w-3 mr-1" />
            Hide address fields
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3 mr-1" />
            Edit address manually
          </>
        )}
      </Button>

      {/* Manual Address Fields */}
      {showManualFields && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-md">
          <div className="col-span-2">
            <Label className="text-xs">Address Line 1</Label>
            <Input
              value={value.address_line1}
              onChange={(e) => handleManualFieldChange('address_line1', e.target.value)}
              placeholder="Street address"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Address Line 2</Label>
            <Input
              value={value.address_line2}
              onChange={(e) => handleManualFieldChange('address_line2', e.target.value)}
              placeholder="Apt, suite, unit, etc."
            />
          </div>
          <div>
            <Label className="text-xs">City</Label>
            <Input
              value={value.city}
              onChange={(e) => handleManualFieldChange('city', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">State / Province</Label>
            <Input
              value={value.state}
              onChange={(e) => handleManualFieldChange('state', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Postal Code</Label>
            <Input
              value={value.postal_code}
              onChange={(e) => handleManualFieldChange('postal_code', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Input
              value={value.country}
              onChange={(e) => handleManualFieldChange('country', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
