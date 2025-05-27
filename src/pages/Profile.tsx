
import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist";
import { useProfileAvatarUpload } from "@/hooks/useProfileAvatarUpload";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

export default function Profile() {
  const { user, isArtist } = useAuth();
  const currentUserArtist = useCurrentUserArtist();
  const { uploadAvatar, isUploading, uploadError } = useProfileAvatarUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isArtist && currentUserArtist?.image_url) {
      logger.log('Artist profile image_url:', currentUserArtist.image_url);
      setCurrentAvatarUrl(currentUserArtist.image_url);
    } else if (user?.user_metadata?.avatar_url) {
      logger.log('User metadata avatar_url:', user.user_metadata.avatar_url);
      setCurrentAvatarUrl(user.user_metadata.avatar_url);
    } else {
        logger.log('No avatar URL found, using fallback.');
        setCurrentAvatarUrl(undefined);
    }
  }, [user, isArtist, currentUserArtist]);


  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("File too large", { description: "Please select an image smaller than 5MB."});
        return;
      }
      const newAvatarUrl = await uploadAvatar(file);
      if (newAvatarUrl) {
        setCurrentAvatarUrl(newAvatarUrl); // Update local state immediately
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const getFallback = () => {
    return user?.email?.substring(0, 2).toUpperCase() || '??';
  }

  if (!user) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto text-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <Card className="w-full max-w-md mx-auto p-4 shadow-md">
        <CardHeader className="flex flex-col items-center">
          <div className="relative group">
            <Avatar className="h-24 w-24 mb-4 border-2 border-muted group-hover:border-primary transition-colors">
              <AvatarImage src={currentAvatarUrl} alt={user.email || "User Avatar"} />
              <AvatarFallback className="text-2xl">
                {getFallback()}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              size="icon"
              className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-background opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={triggerFileInput}
              disabled={isUploading}
              aria-label="Upload new avatar"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            </Button>
            <Input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              className="hidden"
              accept="image/png, image/jpeg, image/gif"
              disabled={isUploading}
            />
          </div>
          <CardTitle className="mt-2 text-xl font-semibold">{user.user_metadata?.display_name || user.email}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 mt-4">
          {uploadError && <p className="text-sm text-destructive text-center">{uploadError}</p>}
          <div className="flex items-center gap-3 border rounded-md p-3 bg-muted/50">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground font-semibold">Email</div>
              <div className="text-sm font-medium">{user.email}</div>
            </div>
          </div>
          {isArtist && currentUserArtist && (
            <div className="border rounded-md p-3 bg-muted/50">
              <div className="text-xs text-muted-foreground font-semibold">Artist Profile</div>
              <div className="text-sm font-medium">Name: {currentUserArtist.full_name}</div>
              {currentUserArtist.image_url && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your artist profile image is currently used as your avatar. Uploading a new avatar here will override it for your user profile but not the artist listing.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
