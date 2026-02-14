import { useState, useMemo } from "react";
import { useAudioTracks } from "@/hooks/use-audio-tracks";
import { useAudioCollections } from "@/hooks/use-audio-collections";
import { AudioTrackCard } from "@/components/audio/AudioTrackCard";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Search, FolderOpen, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function AudioLibrary() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sort, setSort] = useState("newest");

  const { data: tracks, isLoading } = useAudioTracks({ search, tags: selectedTag ? [selectedTag] : undefined, sort });
  const { data: collections } = useAudioCollections();

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tracks?.forEach((t) => t.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [tracks]);

  return (
    <>
      <Helmet>
        <title>Audio Library</title>
        <meta name="description" content="Browse and listen to our audio collection" />
      </Helmet>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">Audio Library</h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tracks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            className="h-11 rounded-[10px] bg-secondary/80 px-4 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">A–Z</option>
          </select>
        </div>

        {allTags.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedTag(null)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${!selectedTag ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${selectedTag === tag ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Collections */}
        {collections && collections.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">Collections</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {collections.map((col) => (
                <Link
                  key={col.id}
                  to={`/audio/collections/${col.slug}`}
                  className="border border-border rounded-xl p-4 hover:shadow-md transition-shadow bg-card"
                >
                  <FolderOpen className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-medium text-sm truncate text-foreground">{col.title}</h3>
                  {col.description && <p className="text-xs text-muted-foreground truncate mt-1">{col.description}</p>}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tracks */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tracks?.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {tracks.map((track) => (
              <AudioTrackCard key={track.id} track={track} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-12">No tracks found.</p>
        )}
      </div>
    </>
  );
}
