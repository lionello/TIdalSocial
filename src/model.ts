import fetch from "node-fetch"
import { spawn } from "child_process"

import { HTTPError } from "./error.js"
import { isOffline } from "./offline.js"

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

export const UNKNOWN_ARTIST_MIX = "005002a0ac4ea84e66f2476d2857c6"

export interface Recommendation {
  playlists?: string[]
  artists?: string[]
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
  if (isOffline())
    return {
      playlists: update ? [] : [UNKNOWN_ARTIST_MIX],
      artists: recommend ? ["unknown"] : [],
    }
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

export async function saveModel(): Promise<void> {
  if (isOffline()) return
  const response = await fetch(`${MODEL_HOST}/save`, { method: "POST" })
  if (response.status !== 204) {
    throw new HTTPError(await response.text())
  }
}

export const defaultPythonPath = process.platform != "win32" ? "python3" : "py"

export function start(): void {
  const child = spawn(defaultPythonPath, ["model/app.py"], {
    stdio: ["ignore", "inherit", "inherit"],
  })

  child.on("error", (err) => {
    console.error(err)
  })

  process.on("SIGTERM", () => {
    child.kill("SIGTERM")
  })
}

if (!isOffline()) start()
