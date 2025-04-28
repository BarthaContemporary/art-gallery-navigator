
import { useState } from "react";
import { LocationSearch } from "@/components/locations/LocationSearch";
import { LocationGrid } from "@/components/locations/LocationGrid";
import { PageHeader } from "@/components/layout/PageHeader";

const Locations = () => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="LOCATIONS" />
      <LocationSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <LocationGrid searchTerm={searchTerm} />
    </div>
  );
};

export default Locations;
