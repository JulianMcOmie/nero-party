interface DeezerTrack {
  spotifyTrackId: string;
  title: string;
  artist: string;
  albumArtUrl: string;
  previewUrl: string | null;
  bpm: number | null;
}

export async function getTrackBpm(trackId: string): Promise<number | null> {
  const url = `https://api.deezer.com/track/${trackId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { bpm?: number };
    const bpm = data.bpm || null;
    console.log(`[Deezer] Track ${trackId} BPM: ${bpm}`);
    return bpm;
  } catch (err) {
    console.error(`[Deezer] Error fetching BPM for track ${trackId}:`, err);
    return null;
  }
}

export async function searchTracks(query: string): Promise<DeezerTrack[]> {
  const url = new URL("https://api.deezer.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Deezer search failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    data: Array<{
      id: number;
      title: string;
      artist: { name: string };
      album: { cover_medium: string };
      preview: string;
    }>;
  };

  return data.data.map((item) => ({
    spotifyTrackId: String(item.id),
    title: item.title,
    artist: item.artist.name,
    albumArtUrl: item.album.cover_medium ?? "",
    previewUrl: item.preview || null,
    bpm: null,
  }));
}
