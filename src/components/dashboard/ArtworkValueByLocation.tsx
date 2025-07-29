import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';
import { useArtworks } from '@/hooks/use-artworks';
import { useLocations } from '@/hooks/use-locations';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface LocationValue {
  locationId: string;
  locationName: string;
  artworkCount: number;
  totalValueGBP: number;
}

// Hook to fetch and convert all currencies to GBP
function useLocationValuesInGBP() {
  const { data: artworks = [], isLoading: artworksLoading } = useArtworks();
  const { data: locations = [], isLoading: locationsLoading } = useLocations();

  return useQuery({
    queryKey: ['location-values-gbp', artworks.length, locations.length],
    queryFn: async (): Promise<LocationValue[]> => {
      if (!artworks.length || !locations.length) return [];

      // Get all unique currencies from artworks
      const currencies = [...new Set(artworks.map(a => a.currency).filter(Boolean))];
      
      // Fetch conversion rates to GBP for all currencies
      const conversionRates: Record<string, number> = { 'GBP': 1 };
      
      for (const currency of currencies) {
        if (currency === 'GBP') continue;
        
        try {
          const { data } = await supabase.functions.invoke('exchange-rates', {
            body: { from: currency, to: 'GBP' }
          });
          
          if (data?.rate) {
            // Apply the 1.5% markup and round up to next 200 as per the conversion logic
            conversionRates[currency] = data.rate;
          }
        } catch (error) {
          console.warn(`Failed to get conversion rate for ${currency}:`, error);
          // Use fallback rates or skip
          conversionRates[currency] = 1; // Fallback
        }
      }

      // Group artworks by location and calculate totals
      const locationMap = new Map<string, { name: string; artworks: any[] }>();
      
      // Initialize with all locations
      locations.forEach(location => {
        locationMap.set(location.id, { name: location.name, artworks: [] });
      });

      // Add location for artworks without a location
      locationMap.set('no-location', { name: 'No Location', artworks: [] });

      // Group artworks by location
      artworks.forEach(artwork => {
        const locationId = artwork.location_id || 'no-location';
        const locationData = locationMap.get(locationId);
        
        if (locationData) {
          locationData.artworks.push(artwork);
        }
      });

      // Calculate totals in GBP
      const results: LocationValue[] = [];
      
      locationMap.forEach((data, locationId) => {
        if (data.artworks.length === 0) return; // Skip locations with no artworks

        let totalValueGBP = 0;

        data.artworks.forEach(artwork => {
          if (artwork.price && artwork.currency) {
            const price = Number(artwork.price);
            const rate = conversionRates[artwork.currency] || 1;
            
            // Apply conversion formula: rate * 1.015 (add 1.5%) then round up to next 200
            if (artwork.currency === 'GBP') {
              totalValueGBP += price;
            } else {
              const convertedAmount = price * rate * 1.015;
              const roundedAmount = Math.ceil(convertedAmount / 200) * 200;
              totalValueGBP += roundedAmount;
            }
          }
        });

        results.push({
          locationId,
          locationName: data.name,
          artworkCount: data.artworks.length,
          totalValueGBP: Math.round(totalValueGBP)
        });
      });

      return results
        .filter(r => r.artworkCount > 0)
        .sort((a, b) => b.totalValueGBP - a.totalValueGBP);
    },
    enabled: !artworksLoading && !locationsLoading && artworks.length > 0 && locations.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function ArtworkValueByLocation() {
  const { data: locationValues = [], isLoading } = useLocationValuesInGBP();

  // Calculate overall statistics
  const totalArtworks = locationValues.reduce((sum, loc) => sum + loc.artworkCount, 0);
  const totalValue = locationValues.reduce((sum, loc) => sum + loc.totalValueGBP, 0);

  if (isLoading) {
    return (
      <Card className="p-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Artwork Value by Location (GBP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (locationValues.length === 0) {
    return (
      <Card className="p-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Artwork Value by Location (GBP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No artwork data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Artwork Value by Location (GBP)
        </CardTitle>
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>{totalArtworks} artworks across {locationValues.length} locations</span>
          <span className="font-medium">Total: £{totalValue.toLocaleString()}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">Artworks</TableHead>
                <TableHead className="text-right">Total Value (GBP)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locationValues.map((locationValue) => (
                <TableRow key={locationValue.locationId}>
                  <TableCell className="font-medium">{locationValue.locationName}</TableCell>
                  <TableCell className="text-center">{locationValue.artworkCount}</TableCell>
                  <TableCell className="text-right font-mono">
                    £{locationValue.totalValueGBP.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}