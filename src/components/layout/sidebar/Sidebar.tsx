
import React from "react";
import { Sidebar as SidebarComponent, SidebarContent } from "@/components/ui/sidebar";
import { Navigation } from "./Navigation";
import { SidebarProfile } from "./Profile";
import { SidebarNavLogo } from "./components/SidebarNavLogo"; // Added import

export function Sidebar() {
  return (
    <SidebarComponent
      className="hidden sm:flex flex-col w-60 h-full"
      style={{
        minHeight: "100vh",
        textAlign: "left"
      }}
    >
      <SidebarNavLogo /> {/* Added logo here */}
      <Navigation />
      <SidebarContent> {/* This SidebarContent is for content below navigation, like profile */}
        <SidebarProfile />
      </SidebarContent>
    </SidebarComponent>
  );
}
