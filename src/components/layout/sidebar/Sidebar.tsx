
import React from "react";
import { Sidebar as SidebarComponent, SidebarContent } from "@/components/ui/sidebar";
import { Navigation } from "./Navigation";
import { SidebarProfile } from "./Profile";
import { SidebarNavLogo } from "./components/SidebarNavLogo";

export function Sidebar() {
  return (
    <SidebarComponent
      className="flex flex-col h-full bg-white"
      style={{
        width: "200px",
        minHeight: "100vh",
        textAlign: "left"
      }}
    >
      <SidebarNavLogo />
      <Navigation />
      <SidebarContent>
        <SidebarProfile />
      </SidebarContent>
    </SidebarComponent>
  );
}
