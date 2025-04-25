
import React from "react";
import { SidebarNavLogo } from "./sidebar/components/SidebarNavLogo";
import { SidebarNavList } from "./sidebar/components/SidebarNavList";
import { SidebarUserMenu } from "./sidebar/SidebarUserMenu";

export function Sidebar() {
  return (
    <aside
      className="hidden sm:flex flex-col w-60 h-full border-r bg-white"
      style={{
        minHeight: "100vh",
        textAlign: "left"
      }}
    >
      <SidebarNavLogo />
      <SidebarNavList />
      <SidebarUserMenu />
    </aside>
  );
}
