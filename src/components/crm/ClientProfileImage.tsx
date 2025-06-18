
import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ClientProfileImageProps {
  fullName: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  size?: "sm" | "md" | "lg";
}

export function ClientProfileImage({ 
  fullName, 
  instagramHandle, 
  linkedinHandle,
  size = "md" 
}: ClientProfileImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12", 
    lg: "h-16 w-16"
  };

  useEffect(() => {
    // For now, we'll use a placeholder implementation
    // In a real app, you'd integrate with Instagram/LinkedIn APIs
    const fetchProfileImage = async () => {
      if (!instagramHandle && !linkedinHandle) return;
      
      setIsLoading(true);
      
      try {
        // Placeholder logic - in reality you'd call your backend
        // that safely fetches profile images from social media APIs
        if (instagramHandle) {
          // Instagram profile image logic would go here
          console.log('Would fetch Instagram profile for:', instagramHandle);
        } else if (linkedinHandle) {
          // LinkedIn profile image logic would go here  
          console.log('Would fetch LinkedIn profile for:', linkedinHandle);
        }
      } catch (error) {
        console.error('Failed to fetch profile image:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileImage();
  }, [instagramHandle, linkedinHandle]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  return (
    <Avatar className={sizeClasses[size]}>
      {imageUrl && (
        <AvatarImage 
          src={imageUrl} 
          alt={`${fullName} profile`}
          className="object-cover"
        />
      )}
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {getInitials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
