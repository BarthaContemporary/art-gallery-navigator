
import React from 'react';
import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface UserMenuItemsProps {
  onSignOut: () => void;
}

export function UserMenuItems({ onSignOut }: UserMenuItemsProps) {
  const navigate = useNavigate();

  return (
    <>
      <DropdownMenuLabel className="text-xs">My Account</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => navigate("/profile")}
        className="cursor-pointer"
      >
        <User className="mr-2 h-4 w-4" />
        Profile
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={onSignOut}
        className="cursor-pointer text-destructive"
      >
        Log out
      </DropdownMenuItem>
    </>
  );
}
