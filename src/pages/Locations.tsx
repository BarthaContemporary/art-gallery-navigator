
import { useState } from "react";
import { LocationHeader } from "@/components/locations/LocationHeader";
import { LocationSearch } from "@/components/locations/LocationSearch";
import { LocationGrid } from "@/components/locations/LocationGrid";

const Locations = () => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="pt-6 pb-6 px-6">
      <LocationHeader />
      <LocationSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <LocationGrid searchTerm={searchTerm} />
    </div>
  );
};

export default Locations;
