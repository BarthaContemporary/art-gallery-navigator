
import { useAuth } from "@/hooks/use-auth";
import { useArtists, Artist } from "@/hooks/useArtists";

/**
 * Custom hook to get the full Artist object for the currently authenticated user,
 * if they are an artist and their artist profile exists.
 * @returns The Artist object or null if not an artist or profile not found.
 */
export function useCurrentUserArtist(): Artist | null {
  const { user, isArtist } = useAuth(); // isArtist comes from useUserRoles -> has_role('artist')
  const { data: artists, isLoading: artistsLoading } = useArtists();

  if (artistsLoading || !isArtist || !user || !artists) {
    return null;
  }

  const currentUserArtist = artists.find(artist => artist.user_id === user.id);
  
  return currentUserArtist || null;
}
