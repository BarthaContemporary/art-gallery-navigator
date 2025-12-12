import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Linkedin, ExternalLink, Check, X, Loader2, User } from 'lucide-react';
import { useLinkedInProfileSearch, LinkedInProfile } from '@/hooks/crm/use-linkedin-profile-search';
import { useUpdateCRMContact } from '@/hooks/crm';
import { toast } from 'sonner';

interface LinkedInProfilePanelProps {
  contactId: string;
  fullName: string;
  company?: string;
  jobTitle?: string;
  currentProfileImageUrl?: string;
  currentLinkedInHandle?: string;
  onProfileUpdated?: () => void;
}

export function LinkedInProfilePanel({
  contactId,
  fullName,
  company,
  jobTitle,
  currentProfileImageUrl,
  currentLinkedInHandle,
  onProfileUpdated,
}: LinkedInProfilePanelProps) {
  const [selectedProfile, setSelectedProfile] = useState<LinkedInProfile | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  const {
    searchProfiles,
    fetchProfileImage,
    downloadAndStoreImage,
    clearResults,
    profiles,
    isSearching,
    isFetchingImage,
    error,
  } = useLinkedInProfileSearch();

  const updateContact = useUpdateCRMContact();

  const handleSearch = async () => {
    await searchProfiles(fullName, company, jobTitle);
  };

  const handleSelectProfile = async (profile: LinkedInProfile) => {
    setSelectedProfile(profile);
    setIsLoadingImage(true);
    setProfileImage(null);

    const imageUrl = await fetchProfileImage(profile.profileUrl);
    if (imageUrl) {
      setProfileImage(imageUrl);
    }
    setIsLoadingImage(false);
  };

  const handleApplyProfile = async () => {
    if (!selectedProfile) return;

    try {
      // Extract handle from URL
      const handle = selectedProfile.profileUrl.split('/in/')[1]?.replace(/\/$/, '');
      
      let storedImageUrl = profileImage;
      if (profileImage) {
        // Try to download and store the image
        const downloadedUrl = await downloadAndStoreImage(profileImage, contactId);
        if (downloadedUrl) {
          storedImageUrl = downloadedUrl;
        }
      }

      // Update the contact
      await updateContact.mutateAsync({
        id: contactId,
        linkedin_handle: handle,
        profile_image_url: storedImageUrl || undefined,
      });

      toast.success('Profile updated successfully');
      clearResults();
      setSelectedProfile(null);
      setProfileImage(null);
      onProfileUpdated?.();
    } catch (err) {
      console.error('Failed to apply profile:', err);
      toast.error('Failed to update profile');
    }
  };

  const handleCancel = () => {
    clearResults();
    setSelectedProfile(null);
    setProfileImage(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Linkedin className="h-4 w-4" />
          LinkedIn Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current profile info */}
        {(currentProfileImageUrl || currentLinkedInHandle) && (
          <div className="flex items-center gap-3 p-2 bg-muted/50 rounded">
            {currentProfileImageUrl && (
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentProfileImageUrl} alt={fullName} />
                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
            )}
            {currentLinkedInHandle && (
              <a
                href={`https://www.linkedin.com/in/${currentLinkedInHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                @{currentLinkedInHandle}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Search button */}
        {profiles.length === 0 && !selectedProfile && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {isSearching ? 'Searching...' : 'Find LinkedIn Profile'}
          </Button>
        )}

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Search results */}
        {profiles.length > 0 && !selectedProfile && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Found {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
              </p>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {profiles.map((profile, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectProfile(profile)}
                  className="w-full text-left p-2 rounded border hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium truncate">{profile.name}</p>
                  {profile.headline && (
                    <p className="text-xs text-muted-foreground truncate">{profile.headline}</p>
                  )}
                  <p className="text-xs text-primary truncate">{profile.profileUrl}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected profile review */}
        {selectedProfile && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Review Profile</Badge>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded">
              {isLoadingImage || isFetchingImage ? (
                <Skeleton className="h-16 w-16 rounded-full shrink-0" />
              ) : profileImage ? (
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarImage src={profileImage} alt={selectedProfile.name} />
                  <AvatarFallback><User className="h-6 w-6" /></AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className="font-medium">{selectedProfile.name}</p>
                {selectedProfile.headline && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{selectedProfile.headline}</p>
                )}
                <a
                  href={selectedProfile.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  View on LinkedIn
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApplyProfile}
                disabled={updateContact.isPending || isLoadingImage}
                className="flex-1"
              >
                {updateContact.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Apply
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
