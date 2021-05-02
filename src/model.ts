import fetch from "node-fetch"
import { spawn, exec } from "child_process"

export interface Track {
  trackName: string
  trackUrl?: string
  artists: string[]
  // artistUrls?: string[]
  albumTitle?: string
  albumUrl?: string
}

export interface TrackList {
  id: string
  url: string
  tracks: Track[]
  title?: string
}

const MODEL_HOST = "http://localhost:5000"

export interface Recommendation {
  playlists: string[]
  artists: string[]
}

type Options = {
  update?: boolean
  recommend?: boolean
}

export async function processPlaylist(
  playlist: TrackList,
  options: Options = {}
): Promise<Recommendation> {
  const { update = true, recommend = false } = options
  const response = await fetch(
    `${MODEL_HOST}/playlist?update=${update ? 1 : 0}&recommend=${recommend ? 1 : 0}`,
    {
      method: "POST",
      body: JSON.stringify(playlist),
      headers: { "Content-Type": "application/json" },
    }
  )
  return response.json()
}

const child = spawn("python3", ["model/app.py"], {
  stdio: ["ignore", "inherit", "inherit"],
})
child.on("error", (err) => {
  console.error(err)
})
