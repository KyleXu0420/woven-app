"use client";

// Activity — the full episodic feed that the Today "Since you were away" digest previews: everything your
// team and the agent have moved across the space, newest first. Awareness, not decisions (that's the Inbox).
// Reuses EpisodeRow so the row grammar stays identical to the Today preview.

import { RowList } from "@/components/today-ui";
import { EpisodeRow } from "@/components/catch-up";
import { recentEpisodes } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";

export default function ActivityPage() {
  useGraphVersion();
  const eps = recentEpisodes(50);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-serif text-3xl font-medium tracking-[-0.01em]">Activity</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything your team and the agent have moved across your space — newest first.
      </p>

      <div className="mt-7">
        {eps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <RowList>
            {eps.map((ep) => (
              <EpisodeRow key={ep.id} ep={ep} />
            ))}
          </RowList>
        )}
      </div>
    </div>
  );
}
