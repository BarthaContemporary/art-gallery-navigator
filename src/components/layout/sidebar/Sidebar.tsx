
import React from "react";
import { Sidebar as SidebarComponent, SidebarContent } from "@/components/ui/sidebar";
import { SidebarNavigation } from "./Navigation";
import { SidebarProfile } from "./Profile";

export function Sidebar() {
  return (
    <SidebarComponent
      className="hidden sm:flex flex-col w-60 h-full"
      style={{
        minHeight: "100vh",
        textAlign: "left"
      }}
    >
      <SidebarNavigation />
      <SidebarContent>
        <SidebarProfile />
      </SidebarContent>
    </SidebarComponent>
  );
}
