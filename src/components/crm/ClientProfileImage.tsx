
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

        // Try using Instagram's direct image API approach (more reliable)
        if (instagramHandle) {
          const cleanHandle = instagramHandle.replace(/^@/, '');
          
          // Try Instagram's profile picture endpoint (sometimes works)
          try {
            const instagramUrl = `https://www.instagram.com/${cleanHandle}/`;
            // Use a CORS proxy service that might work better
            const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(instagramUrl)}`;
            
            const response = await fetch(proxyUrl);
            if (response.ok) {
              const html = await response.text();
              
              // Look for profile image in various meta tags and JSON-LD
              const metaImageMatch = html.match(/"profile_pic_url_hd":"([^"]+)"/);
              const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
              
              if (metaImageMatch && metaImageMatch[1]) {
                profileImageUrl = metaImageMatch[1].replace(/\\u0026/g, '&');
              } else if (ogImageMatch && ogImageMatch[1]) {
                profileImageUrl = ogImageMatch[1];
              }
            }
          } catch (error) {
            console.log('Instagram direct fetch failed:', error);
          }
        }
        
        // Try LinkedIn approach if Instagram failed
        if (!profileImageUrl && linkedinHandle) {
          const cleanHandle = linkedinHandle.replace(/.*linkedin\.com\/in\//, '').replace(/\/$/, '');
          
          try {
            // LinkedIn's profile images are harder to get due to authentication requirements
            // This is a basic attempt that may not work consistently
            const linkedinUrl = `https://www.linkedin.com/in/${cleanHandle}/`;
            const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(linkedinUrl)}`;
            
            const response = await fetch(proxyUrl);
            if (response.ok) {
              const html = await response.text();
              const metaImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
              
              if (metaImageMatch && metaImageMatch[1]) {
                profileImageUrl = metaImageMatch[1];
              }
            }
          } catch (error) {
            console.log('LinkedIn fetch failed:', error);
          }
        }

        // Fallback to avatar generation service if social media fetch fails
        if (!profileImageUrl) {
          // Use a reliable avatar generation service as fallback
          const initials = getInitials(fullName);
          profileImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128&background=3B82F6&color=FFFFFF&bold=true`;
        }

        if (profileImageUrl) {
          setImageUrl(profileImageUrl);
        }
      } catch (error) {
        console.error('Failed to fetch profile image:', error);
        // Use avatar generation service as final fallback
        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128&background=3B82F6&color=FFFFFF&bold=true`;
        setImageUrl(fallbackUrl);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileImage();
  }, [instagramHandle, linkedinHandle, fullName]);

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
          onError={() => {
            // If the fetched image fails to load, try the avatar service fallback
            const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128&background=3B82F6&color=FFFFFF&bold=true`;
            setImageUrl(fallbackUrl);
          }}
        />
      )}
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {isLoading ? "..." : getInitials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
