
import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Upload, User } from "lucide-react";
import { useProfileAvatarUpload } from "@/hooks/useProfileAvatarUpload";

interface ClientProfileImageProps {
  fullName: string;
  email?: string;
  profileImageUrl?: string;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  onImageUpdate?: (imageUrl: string) => void;
}

export function ClientProfileImage({ 
  fullName, 
  email,
  profileImageUrl,
  size = "md",
  editable = false,
  onImageUpdate
}: ClientProfileImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { uploadAvatar, isUploading } = useProfileAvatarUpload();

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12", 
    lg: "h-16 w-16"
  };

  useEffect(() => {
    const determineImageUrl = () => {
      // Priority 1: Manual upload (profile image URL)
      if (profileImageUrl) {
        setImageUrl(profileImageUrl);
        return;
      }

      // Priority 2: Gravatar if email exists
      if (email) {
        const gravatarUrl = getGravatarUrl(email);
        setImageUrl(gravatarUrl);
        return;
      }

      // Priority 3: Generated avatar with UI Avatars
      const generatedUrl = getGeneratedAvatarUrl(fullName);
      setImageUrl(generatedUrl);
    };

    determineImageUrl();
  }, [profileImageUrl, email, fullName]);

  const getGravatarUrl = (email: string): string => {
    // Create MD5 hash of email for Gravatar
    const emailHash = btoa(email.toLowerCase().trim()).replace(/[^a-zA-Z0-9]/g, '');
    return `https://www.gravatar.com/avatar/${emailHash}?d=404&s=128`;
  };

  const getGeneratedAvatarUrl = (name: string): string => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=128&background=3B82F6&color=FFFFFF&bold=true`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const uploadedUrl = await uploadAvatar(file);
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
        onImageUpdate?.(uploadedUrl);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageError = () => {
    // If Gravatar fails, fallback to generated avatar
    if (imageUrl?.includes('gravatar.com')) {
      const fallbackUrl = getGeneratedAvatarUrl(fullName);
      setImageUrl(fallbackUrl);
    }
  };

  return (
    <div className="relative inline-block">
      <Avatar className={sizeClasses[size]}>
        {imageUrl && (
          <AvatarImage 
            src={imageUrl} 
            alt={`${fullName} profile`}
            className="object-cover"
            onError={handleImageError}
          />
        )}
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {isLoading || isUploading ? "..." : getInitials(fullName)}
        </AvatarFallback>
      </Avatar>
      
      {editable && (
        <div className="absolute -bottom-1 -right-1">
          <input
            type="file"
            id="profile-image-upload"
            className="hidden"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isLoading || isUploading}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 rounded-full p-0"
            asChild
            disabled={isLoading || isUploading}
          >
            <label htmlFor="profile-image-upload" className="cursor-pointer">
              {isLoading || isUploading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-900" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
            </label>
          </Button>
        </div>
      )}
    </div>
  );
}
