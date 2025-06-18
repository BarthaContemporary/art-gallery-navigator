
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
  size = "md"
}: ClientProfileImageProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base", 
    lg: "text-lg"
  };

  return (
    <div className="text-left">
      <span className={`font-semibold ${sizeClasses[size]}`}>
        {fullName}
      </span>
    </div>
  );
}
