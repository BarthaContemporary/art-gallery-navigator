
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
    const fetchProfileImage = async () => {
      if (!instagramHandle && !linkedinHandle) return;
      
      setIsLoading(true);
      
      try {
        let profileImageUrl = null;

        // Try Instagram first if handle is provided
        if (instagramHandle) {
          const cleanHandle = instagramHandle.replace(/^@/, '');
          // Use Instagram's public profile image endpoint
          profileImageUrl = `https://www.instagram.com/${cleanHandle}/`;
          
          // Try to get the profile image through a proxy service or meta tags
          try {
            const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.instagram.com/${cleanHandle}/`)}`);
            const html = await response.text();
            
            // Extract profile image from meta tags
            const metaImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
            if (metaImageMatch && metaImageMatch[1]) {
              profileImageUrl = metaImageMatch[1];
            }
          } catch (error) {
            console.log('Instagram image fetch failed, trying alternative method:', error);
            // Fallback to a different approach if needed
          }
        }
        
        // Try LinkedIn if Instagram failed and LinkedIn handle is provided
        if (!profileImageUrl && linkedinHandle) {
          const cleanHandle = linkedinHandle.replace(/.*linkedin\.com\/in\//, '').replace(/\/$/, '');
          try {
            const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.linkedin.com/in/${cleanHandle}/`)}`);
            const html = await response.text();
            
            // Extract profile image from LinkedIn meta tags
            const metaImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
            if (metaImageMatch && metaImageMatch[1]) {
              profileImageUrl = metaImageMatch[1];
            }
          } catch (error) {
            console.log('LinkedIn image fetch failed:', error);
          }
        }

        if (profileImageUrl) {
          setImageUrl(profileImageUrl);
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
          onError={() => setImageUrl(null)}
        />
      )}
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {isLoading ? "..." : getInitials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
