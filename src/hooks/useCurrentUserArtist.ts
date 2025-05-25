
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

  // Workaround: Type assertion used here because the imported Artist type
  // might be missing user_id. Ideally, Artist type in useArtists.ts should include user_id.
  const currentUserArtist = artists.find(
    artist => (artist as Artist & { user_id?: string }).user_id === user.id
  );
  
  return currentUserArtist || null;
}
