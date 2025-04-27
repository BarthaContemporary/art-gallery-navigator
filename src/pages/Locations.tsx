
import { useState } from "react";
import { LocationHeader } from "@/components/locations/LocationHeader";
import { LocationSearch } from "@/components/locations/LocationSearch";
import { LocationGrid } from "@/components/locations/LocationGrid";

const Locations = () => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <LocationHeader />
      </div>
      <h1 className="text-3xl tracking-wide text-slate-500 font-thin mb-8">LOCATIONS</h1>
      <LocationSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <LocationGrid searchTerm={searchTerm} />
    </div>
  );
};

export default Locations;
