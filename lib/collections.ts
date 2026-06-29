// Sidebar-facing collection list, derived from the typed graph (lib/data via lib/api) so
// it never drifts from the collection pages. The pages themselves read lib/api directly;
// this shim exists only so the sidebar's import stays stable.

import { collectionMembers, listCollections } from "./api";

export type CollectionMeta = { slug: string; name: string; color: string; count: number };

export const COLLECTIONS: CollectionMeta[] = listCollections().map((c) => ({
  slug: c.slug,
  name: c.name,
  color: c.color,
  count: collectionMembers(c.slug).length,
}));

export function collectionBySlug(slug: string): CollectionMeta {
  return COLLECTIONS.find((c) => c.slug === slug) ?? COLLECTIONS[0];
}
