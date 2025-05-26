
import { useState } from "react";
import { ProjectsHeader } from "@/components/projects/ProjectsHeader";
import { ProjectsSearch } from "@/components/projects/ProjectsSearch";
import { ProjectsGrid } from "@/components/projects/ProjectsGrid";

const Projects = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      <ProjectsHeader />
      <ProjectsSearch
        search={search}
        status={status}
        type={type}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onTypeChange={setType}
      />
      <ProjectsGrid
        search={search}
        status={status}
        type={type}
      />
    </div>
  );
};

export default Projects;
