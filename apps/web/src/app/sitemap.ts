import type { MetadataRoute } from "next";
import {
  artistSlugsQuery,
  exhibitionSlugsQuery,
  publicationSlugsQuery,
  sanityFetch,
} from "@/lib/sanity";
import { ARTISTS_UNDER_CONSTRUCTION, absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    ...(ARTISTS_UNDER_CONSTRUCTION ? [] : [{ url: absoluteUrl("/artists"), changeFrequency: "weekly" as const, priority: 0.9 }]),
    { url: absoluteUrl("/publications"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/faq"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/glossary"), changeFrequency: "monthly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/cookies"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/aml"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/accessibility"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const [exhibitionSlugs, publicationSlugs, artistSlugs] = await Promise.all([
    sanityFetch<string[]>({ query: exhibitionSlugsQuery, tags: ["exhibition"], fallback: [] }),
    sanityFetch<string[]>({ query: publicationSlugsQuery, tags: ["publication"], fallback: [] }),
    sanityFetch<string[]>({ query: artistSlugsQuery, tags: ["artist"], fallback: [] }),
  ]);

  return [
    ...staticRoutes,
    ...exhibitionSlugs.map((slug) => ({
      url: absoluteUrl(`/events/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...(ARTISTS_UNDER_CONSTRUCTION ? [] : artistSlugs).map((slug) => ({
      url: absoluteUrl(`/artists/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...publicationSlugs.map((slug) => ({
      url: absoluteUrl(`/publications/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
