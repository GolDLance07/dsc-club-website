import { useState, useEffect, useCallback } from "react";
import { getPublishedEvents, getArchivedEvents } from "@/lib/firebase/events";
import type { CentralizedClubEvent } from "@/types/models";

interface UsePublicEventsOptions {
  includeArchived?: boolean;
}

interface UsePublicEventsResult {
  publishedEvents: CentralizedClubEvent[];
  archivedEvents: CentralizedClubEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches published (and optionally archived) events from centralized Firestore.
 * Guarantees draft events are never returned to public UI views and provides
 * consistent loading, empty, and error states across homepage and /events routes.
 */
export function usePublicEvents(
  options: UsePublicEventsOptions = {}
): UsePublicEventsResult {
  const { includeArchived = false } = options;
  const [publishedEvents, setPublishedEvents] = useState<CentralizedClubEvent[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<CentralizedClubEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPublicEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pub, arch] = await Promise.all([
        getPublishedEvents(),
        includeArchived ? getArchivedEvents() : Promise.resolve([]),
      ]);
      // Strict defensive guard: only expose 'published' and 'archived' statuses publicly
      setPublishedEvents(pub.filter((evt) => evt.status === "published"));
      setArchivedEvents(arch.filter((evt) => evt.status === "archived"));
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to load club events right now. Please try again shortly.";
      console.error("[DSC PublicEvents] Error fetching events:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    fetchPublicEvents();
  }, [fetchPublicEvents]);

  return {
    publishedEvents,
    archivedEvents,
    loading,
    error,
    refetch: fetchPublicEvents,
  };
}
