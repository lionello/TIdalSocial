import fetch from "node-fetch"
import { Track } from "./parse"

export interface Playlist {
  title?: string
  url: string
  tracks: Track[]
}

export interface Recommendation {
  playlists: string[]
  artists: string[]
}

export async function process_playlist(
  playlist: Playlist,
  { update = true }: { update?: boolean } = {}
): Promise<Recommendation> {
  const response = await fetch(
    `http://localhost:5000/playlist?update=${update ? 1 : 0}`,
    {
      method: "POST",
      body: JSON.stringify(playlist),
      headers: { "Content-Type": "application/json" },
    }
  )
  return response.json()
}
