
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
    <div className="px-4 py-4 mt-auto flex justify-start">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full p-0 h-auto flex justify-start">
            <UserAvatar 
              imageUrl={user?.user_metadata.avatar_url}
              email={user?.email}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-50 min-w-[180px] shadow-lg bg-background border">
          <UserMenuItems onSignOut={signOut} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
