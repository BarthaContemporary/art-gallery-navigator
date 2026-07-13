import type { MetadataRoute } from "next";
import {
  collectionSlugsQuery,
  exhibitionSlugsQuery,
  journalSlugsQuery,
  publicationSlugsQuery,
  sanityFetch,
  workSlugsQuery,
} from "@/lib/sanity";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/exhibitions"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/publications"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/works"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/collections"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/journal"), changeFrequency: "weekly", priority: 0.5 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/visit"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/faq"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/glossary"), changeFrequency: "monthly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/cookies"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/aml"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const [workSlugs, collectionSlugs, exhibitionSlugs, publicationSlugs, journalSlugs] =
    await Promise.all([
      sanityFetch<string[]>({ query: workSlugsQuery, tags: ["work"], fallback: [] }),
      sanityFetch<string[]>({ query: collectionSlugsQuery, tags: ["collection"], fallback: [] }),
      sanityFetch<string[]>({ query: exhibitionSlugsQuery, tags: ["exhibition"], fallback: [] }),
      sanityFetch<string[]>({ query: publicationSlugsQuery, tags: ["publication"], fallback: [] }),
      sanityFetch<string[]>({ query: journalSlugsQuery, tags: ["journalPost"], fallback: [] }),
    ]);

  return [
    ...staticRoutes,
    ...exhibitionSlugs.map((slug) => ({
      url: absoluteUrl(`/exhibitions/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...publicationSlugs.map((slug) => ({
      url: absoluteUrl(`/publications/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...workSlugs.map((slug) => ({
      url: absoluteUrl(`/works/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...collectionSlugs.map((slug) => ({
      url: absoluteUrl(`/collections/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...journalSlugs.map((slug) => ({
      url: absoluteUrl(`/journal/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
