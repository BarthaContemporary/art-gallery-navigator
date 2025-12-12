import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, Linkedin, ExternalLink, Check, X, Loader2, User, Link } from 'lucide-react';
import { useLinkedInProfileSearch, LinkedInProfile } from '@/hooks/crm/use-linkedin-profile-search';

interface LinkedInSearchInputProps {
  fullName: string;
  company?: string;
  jobTitle?: string;
  linkedinHandle: string;
  profileImageUrl?: string;
  onLinkedInChange: (handle: string) => void;
  onProfileImageChange: (url: string) => void;
  contactId?: string;
}

export function LinkedInSearchInput({
  fullName,
  company,
  jobTitle,
  linkedinHandle,
  profileImageUrl,
  onLinkedInChange,
  onProfileImageChange,
  contactId,
}: LinkedInSearchInputProps) {
  const [selectedProfile, setSelectedProfile] = useState<LinkedInProfile | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const {
    searchProfiles,
    fetchProfileImage,
    downloadAndStoreImage,
    clearResults,
    profiles,
    isSearching,
    isFetchingImage,
  } = useLinkedInProfileSearch();

  const handleSearch = async () => {
    await searchProfiles(fullName, company, jobTitle);
    setShowResults(true);
  };

  const handleSelectProfile = async (profile: LinkedInProfile) => {
    if (profile.profileUrl.includes('google.com/search')) {
      window.open(profile.profileUrl, '_blank');
      setShowManualInput(true);
      return;
    }

    setSelectedProfile(profile);
    setIsLoadingImage(true);
    setProfileImage(null);

    const imageUrl = await fetchProfileImage(profile.profileUrl);
    if (imageUrl) {
      setProfileImage(imageUrl);
    }
    setIsLoadingImage(false);
  };

  const handleManualUrlSubmit = async () => {
    if (!manualUrl) return;

    let url = manualUrl.trim();
    if (!url.startsWith('http')) {
      url = `https://www.linkedin.com/in/${url.replace('@', '').replace('linkedin.com/in/', '')}`;
    }

    setSelectedProfile({
      name: fullName,
      profileUrl: url,
      isGenerated: false,
    });
    setIsLoadingImage(true);
    setProfileImage(null);

    const imageUrl = await fetchProfileImage(url);
    if (imageUrl) {
      setProfileImage(imageUrl);
    }
    setIsLoadingImage(false);
    setShowManualInput(false);
  };

  const handleApplyProfile = async () => {
    if (!selectedProfile) return;

    const handle = selectedProfile.profileUrl.split('/in/')[1]?.replace(/\/$/, '').split('?')[0];
    
    let storedImageUrl = profileImage;
    if (profileImage && contactId) {
      const downloadedUrl = await downloadAndStoreImage(profileImage, contactId);
      if (downloadedUrl) {
        storedImageUrl = downloadedUrl;
      }
    }

    onLinkedInChange(handle || '');
    if (storedImageUrl) {
      onProfileImageChange(storedImageUrl);
    }

    handleCancel();
  };

  const handleCancel = () => {
    clearResults();
    setSelectedProfile(null);
    setProfileImage(null);
    setShowManualInput(false);
    setShowResults(false);
    setManualUrl('');
  };

  return (
    <div className="space-y-2">
      <Label>LinkedIn</Label>
      <div className="flex gap-2">
        <Input
          placeholder="linkedin.com/in/..."
          value={linkedinHandle}
          onChange={(e) => onLinkedInChange(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleSearch}
          disabled={isSearching || !fullName}
          title="Search LinkedIn"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Linkedin className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Search results */}
      {showResults && profiles.length > 0 && !selectedProfile && (
        <div className="border rounded p-2 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Suggested profiles</p>
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {profiles.map((profile, index) => (
              <button
                type="button"
                key={index}
                onClick={() => handleSelectProfile(profile)}
                className="w-full text-left p-1.5 rounded border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {profile.profileUrl.includes('google.com') ? (
                    <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : (
                    <Linkedin className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs truncate flex-1">{profile.name}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              clearResults();
              setShowResults(false);
              setShowManualInput(true);
            }}
            className="w-full text-xs"
          >
            <Link className="h-3 w-3 mr-1" />
            Enter URL manually
          </Button>
        </div>
      )}

      {/* Manual URL input */}
      {showManualInput && !selectedProfile && (
        <div className="border rounded p-2 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Enter LinkedIn URL</p>
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="linkedin.com/in/..."
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              className="text-sm"
            />
            <Button type="button" size="sm" onClick={handleManualUrlSubmit} disabled={!manualUrl}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Selected profile review */}
      {selectedProfile && (
        <div className="border rounded p-2 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">Review</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingImage || isFetchingImage ? (
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            ) : profileImage ? (
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={profileImage} alt={selectedProfile.name} />
                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedProfile.name}</p>
              <a
                href={selectedProfile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View profile
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleApplyProfile} disabled={isLoadingImage} className="flex-1">
              {isLoadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
