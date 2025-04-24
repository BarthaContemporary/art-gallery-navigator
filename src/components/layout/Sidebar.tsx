
import React from "react";
import { SidebarLogo } from "./sidebar/SidebarLogo";
import { SidebarNav } from "./sidebar/SidebarNav";
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
      <SidebarLogo />
      <SidebarNav />
      <SidebarUserMenu />
    </aside>
  );
}
