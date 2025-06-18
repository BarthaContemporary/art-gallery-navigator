
import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Upload, User } from "lucide-react";
import { useProfileAvatarUpload } from "@/hooks/useProfileAvatarUpload";
import { useSocialProfileImages } from "@/hooks/useSocialProfileImages";

interface ClientProfileImageProps {
  fullName: string;
  email?: string;
  profileImageUrl?: string;
  linkedinHandle?: string;
  instagramHandle?: string;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  onImageUpdate?: (imageUrl: string) => void;
}

export function ClientProfileImage({ 
  fullName, 
  email,
  profileImageUrl,
  linkedinHandle,
  instagramHandle,
  size = "md",
  editable = false,
  onImageUpdate
}: ClientProfileImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { uploadAvatar, isUploading } = useProfileAvatarUpload();
  const { fetchLinkedInImage, fetchInstagramImage } = useSocialProfileImages();

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12", 
    lg: "h-16 w-16"
  };

  // Simple MD5 hash implementation for Gravatar
  const md5 = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  useEffect(() => {
    const determineImageUrl = async () => {
      console.log('Determining image URL:', { profileImageUrl, email, fullName, linkedinHandle, instagramHandle });
      
      // Priority 1: Manual upload (profile image URL)
      if (profileImageUrl) {
        console.log('Using profile image URL:', profileImageUrl);
        setImageUrl(profileImageUrl);
        return;
      }

      // Priority 2: Gravatar if email exists
      if (email) {
        const emailHash = md5(email.toLowerCase().trim());
        const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?d=404&s=128`;
        console.log('Checking Gravatar URL:', gravatarUrl);
        
        try {
          const response = await fetch(gravatarUrl, { method: 'HEAD' });
          if (response.ok) {
            setImageUrl(gravatarUrl);
            return;
          }
        } catch (error) {
          console.log('Gravatar not found, trying social media');
        }
      }

      // Priority 3: LinkedIn profile image
      if (linkedinHandle) {
        console.log('Fetching LinkedIn image for:', linkedinHandle);
        const result = await fetchLinkedInImage(linkedinHandle);
        if (result.imageUrl) {
          console.log('Using LinkedIn image:', result.imageUrl);
          setImageUrl(result.imageUrl);
          return;
        }
      }

      // Priority 4: Instagram profile image
      if (instagramHandle) {
        console.log('Fetching Instagram image for:', instagramHandle);
        const result = await fetchInstagramImage(instagramHandle);
        if (result.imageUrl) {
          console.log('Using Instagram image:', result.imageUrl);
          setImageUrl(result.imageUrl);
          return;
        }
      }

      // Priority 5: Generated avatar with UI Avatars
      const generatedUrl = getGeneratedAvatarUrl(fullName);
      console.log('Using generated URL:', generatedUrl);
      setImageUrl(generatedUrl);
    };

    determineImageUrl();
  }, [profileImageUrl, email, fullName, linkedinHandle, instagramHandle, fetchLinkedInImage, fetchInstagramImage]);

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
    console.log('Image failed to load, using fallback for:', imageUrl);
    // If any image fails, fallback to generated avatar
    const fallbackUrl = getGeneratedAvatarUrl(fullName);
    console.log('Falling back to generated avatar:', fallbackUrl);
    setImageUrl(fallbackUrl);
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
