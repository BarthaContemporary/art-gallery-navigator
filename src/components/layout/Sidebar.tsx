
import React from "react";
import { Sidebar as SidebarComponent, SidebarContent } from "@/components/ui/sidebar";
import { SidebarNavLogo } from "./sidebar/components/SidebarNavLogo";
import { SidebarNavList } from "./sidebar/components/SidebarNavList";
import { SidebarUserMenu } from "./sidebar/SidebarUserMenu";

export function Sidebar() {
  return (
    <SidebarComponent
      className="hidden sm:flex flex-col w-60 h-full border-r bg-white"
      style={{
        minHeight: "100vh",
        textAlign: "left"
      }}
    >
      <SidebarNavLogo />
      <SidebarContent>
        <SidebarNavList />
      </SidebarContent>
      <SidebarUserMenu />
    </SidebarComponent>
  );
}
