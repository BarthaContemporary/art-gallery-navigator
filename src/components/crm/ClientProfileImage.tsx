
import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Upload, User, RefreshCw } from "lucide-react";
import { useProfileAvatarUpload } from "@/hooks/useProfileAvatarUpload";
import { useSocialProfileImages } from "@/hooks/useSocialProfileImages";
import { toast } from "sonner";

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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { uploadAvatar, isUploading } = useProfileAvatarUpload();
  const { fetchLinkedInImage, fetchInstagramImage, isLoading: isSocialLoading } = useSocialProfileImages();

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12", 
    lg: "h-16 w-16"
  };

  // Proper MD5 hash implementation for Gravatar
  const md5 = async (str: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    const determineImageUrl = async () => {
      console.log('Determining image URL:', { profileImageUrl, email, fullName, linkedinHandle, instagramHandle });
      setIsLoading(true);
      setFetchError(null);
      
      try {
        // Priority 1: Manual upload (profile image URL)
        if (profileImageUrl) {
          console.log('Using profile image URL:', profileImageUrl);
          setImageUrl(profileImageUrl);
          return;
        }

        // Priority 2: Gravatar if email exists
        if (email) {
          try {
            const emailHash = await md5(email.toLowerCase().trim());
            const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?d=404&s=128`;
            console.log('Checking Gravatar URL:', gravatarUrl);
            
            const response = await fetch(gravatarUrl, { method: 'HEAD' });
            if (response.ok) {
              setImageUrl(gravatarUrl);
              return;
            }
          } catch (error) {
            console.log('Gravatar check failed, trying social media');
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
          } else if (result.error) {
            console.log('LinkedIn fetch error:', result.error);
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
          } else if (result.error) {
            console.log('Instagram fetch error:', result.error);
          }
        }

        // Priority 5: Generated avatar with UI Avatars
        const generatedUrl = getGeneratedAvatarUrl(fullName);
        console.log('Using generated URL:', generatedUrl);
        setImageUrl(generatedUrl);
      } catch (error) {
        console.error('Error determining image URL:', error);
        setFetchError('Failed to load profile image');
        const fallbackUrl = getGeneratedAvatarUrl(fullName);
        setImageUrl(fallbackUrl);
      } finally {
        setIsLoading(false);
      }
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

    try {
      const uploadedUrl = await uploadAvatar(file);
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
        onImageUpdate?.(uploadedUrl);
        toast.success('Profile image updated successfully');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload image');
    }
  };

  const handleRefresh = () => {
    // Force refresh by clearing current image and re-running the effect
    setImageUrl(null);
    setFetchError(null);
  };

  const handleImageError = () => {
    console.log('Image failed to load, using fallback for:', imageUrl);
    const fallbackUrl = getGeneratedAvatarUrl(fullName);
    console.log('Falling back to generated avatar:', fallbackUrl);
    setImageUrl(fallbackUrl);
  };

  const showLoadingSpinner = isLoading || isSocialLoading || isUploading;

  return (
    <div className="relative inline-block">
      <Avatar className={sizeClasses[size]}>
        {imageUrl && !showLoadingSpinner && (
          <AvatarImage 
            src={imageUrl} 
            alt={`${fullName} profile`}
            className="object-cover"
            onError={handleImageError}
          />
        )}
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {showLoadingSpinner ? "..." : getInitials(fullName)}
        </AvatarFallback>
      </Avatar>
      
      {editable && (
        <div className="absolute -bottom-1 -right-1 flex gap-1">
          <input
            type="file"
            id="profile-image-upload"
            className="hidden"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={showLoadingSpinner}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 rounded-full p-0"
            asChild
            disabled={showLoadingSpinner}
          >
            <label htmlFor="profile-image-upload" className="cursor-pointer">
              {showLoadingSpinner ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-900" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
            </label>
          </Button>
          
          {(linkedinHandle || instagramHandle) && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 w-6 rounded-full p-0"
              onClick={handleRefresh}
              disabled={showLoadingSpinner}
              title="Refresh social media images"
            >
              <RefreshCw className="h-2 w-2" />
            </Button>
          )}
        </div>
      )}
      
      {fetchError && editable && (
        <div className="absolute -bottom-8 left-0 text-xs text-red-500 whitespace-nowrap">
          {fetchError}
        </div>
      )}
    </div>
  );
}
