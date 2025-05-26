
import { useState } from "react";
import { LocationSearch } from "@/components/locations/LocationSearch";
import { LocationGrid } from "@/components/locations/LocationGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateLocationDialog } from "@/components/locations/CreateLocationDialog";

const Locations = () => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Changed justify-between to justify-start */}
      <div className="flex flex-wrap justify-start items-center gap-4 mb-6">
        <PageHeader title="LOCATIONS" />
        <CreateLocationDialog /> {/* Button size cannot be changed (read-only component) */}
      </div>
      <LocationSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <LocationGrid searchTerm={searchTerm} />
    </div>
  );
};

export default Locations;

