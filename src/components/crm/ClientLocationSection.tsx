
import { AddressMap } from "./AddressMap";

interface ClientLocationSectionProps {
  client: any;
}

export function ClientLocationSection({ client }: ClientLocationSectionProps) {
  if (!client.address) return null;
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-1">
        Location
      </h3>
      <AddressMap address={client.address} clientName={client.full_name} />
    </div>
  );
}
