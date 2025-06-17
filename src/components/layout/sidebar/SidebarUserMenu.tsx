
import React from 'react';
import { Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from './components/UserAvatar';
import { UserMenuItems } from './components/UserMenuItems';

export function SidebarUserMenu() {
  const { user, signOut } = useAuth();

  return (
    <div className="px-4 py-4 mt-auto bg-white">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-center rounded-md px-2 py-1.5 hover:bg-[#e8c858] hover:text-black"
          >
            <UserAvatar 
              imageUrl={user?.user_metadata.avatar_url}
              email={user?.email}
            />
            <Settings className="h-4 w-4 text-muted-foreground ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-30 min-w-[180px] shadow-lg bg-white">
          <UserMenuItems onSignOut={signOut} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
