import { useEffect, useState } from "react";
import type { TrackInput } from "../party/types";

const API_BASE = `http://${window.location.hostname}:3000`;

export async function searchSpotify(query: string): Promise<TrackInput[]> {
  const res = await fetch(
    `${API_BASE}/api/spotify/search?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error("Search failed");
  return res.json() as Promise<TrackInput[]>;
}

export function useSpotifySearch(query: string) {
  const [results, setResults] = useState<TrackInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const tracks = await searchSpotify(trimmed);
        setResults(tracks);
      } catch {
        setError("Search failed. Check your connection.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading, error };
}
