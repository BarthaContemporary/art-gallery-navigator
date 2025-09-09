
import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist";
import { useProfileAvatarUpload } from "@/hooks/useProfileAvatarUpload";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, UploadCloud, Loader2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { logger } from '@/lib/logger';
import { supabase } from "@/integrations/supabase/client";

export default function Profile() {
  const { user, isArtist } = useAuth();
  const currentUserArtist = useCurrentUserArtist();
  const { uploadAvatar, isUploading, uploadError } = useProfileAvatarUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | undefined>(undefined);
  const [isEditingFullName, setIsEditingFullName] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isUpdatingFullName, setIsUpdatingFullName] = useState(false);

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

    // Set initial full name - prefer artist name if available
    if (isArtist && currentUserArtist?.full_name) {
      setFullName(currentUserArtist.full_name);
    } else {
      setFullName(user?.user_metadata?.full_name || user?.user_metadata?.display_name || '');
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

  const handleUpdateFullName = async () => {
    if (!user || !fullName.trim()) return;

    setIsUpdatingFullName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          display_name: fullName.trim()
        }
      });

      if (error) throw error;

      toast.success("Full name updated successfully");
      setIsEditingFullName(false);
    } catch (error) {
      console.error('Error updating full name:', error);
      toast.error("Failed to update full name");
    } finally {
      setIsUpdatingFullName(false);
    }
  };

  const handleCancelEdit = () => {
    if (isArtist && currentUserArtist?.full_name) {
      setFullName(currentUserArtist.full_name);
    } else {
      setFullName(user?.user_metadata?.full_name || user?.user_metadata?.display_name || '');
    }
    setIsEditingFullName(false);
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
        <CardHeader className="flex flex-col items-start">
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
          <CardTitle className="mt-2 text-xl font-semibold">{fullName || user.email}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 mt-4">
          {uploadError && <p className="text-sm text-destructive text-center">{uploadError}</p>}
          
          {/* Full Name Field */}
          <div className="border rounded-md p-3 bg-muted/50">
            <Label className="text-xs text-muted-foreground font-semibold">Full Name</Label>
            {isEditingFullName ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="flex-1"
                  disabled={isUpdatingFullName}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleUpdateFullName}
                  disabled={isUpdatingFullName || !fullName.trim()}
                  className="h-8 w-8"
                >
                  {isUpdatingFullName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={isUpdatingFullName}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between mt-1">
                <div className="text-sm font-medium">
                  {fullName || 'Not set'}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsEditingFullName(true)}
                  className="h-8 w-8"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

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
              <div className="text-sm font-medium">Status: {currentUserArtist.representation_status}</div>
              {currentUserArtist.image_url && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your artist profile image is currently used as your avatar. You can update your artist image through the Artists panel.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
