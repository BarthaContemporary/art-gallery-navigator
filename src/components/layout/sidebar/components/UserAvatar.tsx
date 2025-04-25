
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface UserAvatarProps {
  imageUrl?: string;
  email?: string;
}

export function UserAvatar({ imageUrl, email }: UserAvatarProps) {
  return (
    <Avatar className="h-8 w-8">
      <AvatarImage src={imageUrl} />
      <AvatarFallback>
        {email?.substring(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
