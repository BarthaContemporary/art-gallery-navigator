
import { useState } from "react";
import { LocationSearch } from "@/components/locations/LocationSearch";
import { LocationGrid } from "@/components/locations/LocationGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateLocationDialog } from "@/components/locations/CreateLocationDialog";

const Locations = () => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <PageHeader title="LOCATIONS" />
        <CreateLocationDialog />
      </div>
      <LocationSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <LocationGrid searchTerm={searchTerm} />
    </div>
  );
};

export default Locations;
