
import React from "react";
import { Sidebar as SidebarComponent, SidebarContent } from "@/components/ui/sidebar";
import { Navigation } from "./Navigation";
import { SidebarProfile } from "./Profile";
import { SidebarNavLogo } from "./components/SidebarNavLogo";

export function Sidebar() {
  return (
    <SidebarComponent
      className="flex flex-col w-16 h-full bg-white border-r"
      style={{
        minHeight: "100vh",
        textAlign: "center"
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
