import { promises as FS } from "fs"
import * as Path from "path"
import { JSDOM } from "jsdom"
import { Playlist } from "./model"

const CacheFolder = "cache"

export interface Track {
  trackName: string
  artists: string[]
  albumTitle?: string
}

const removeParens = / \[[^\]]+\]| \([^)]+\)/g

function parseTrackItem(trackItem: Element): Track {
  const trackInfo = trackItem.getElementsByClassName("track-name")[0]
  const trackName = trackInfo
    .getElementsByTagName("a")[0]
    .firstChild.textContent.trim()
    .replace(removeParens, "")
  const artistList = trackInfo.getElementsByClassName("artist-list")[0]
  const artists = Array.from(
    artistList.getElementsByTagName("a")
  ).map((artist) => artist.textContent.trim())
  const secondaryTitle = trackItem.getElementsByClassName("secondary-title")[0]
  const albumTitle = secondaryTitle
    .getElementsByTagName("a")[0]
    .firstChild.textContent.trim()
    .replace(removeParens, "")
  return {
    trackName,
    artists,
    albumTitle,
  }
}

export function parsePlaylistDocument(playlist: Document): Track[] {
  const trackItems = Array.from(
    playlist.getElementsByClassName("track-item has-info")
  )
  return trackItems.map((trackItem) => parseTrackItem(trackItem))
}

async function importFromURL(url: string): Promise<Track[]> {
  const dom = await JSDOM.fromURL(url) // , { runScripts: "dangerously" })
  return parsePlaylistDocument(dom.window.document)
}

export function getPlaylistURL(guid: string): string {
  return "https://tidal.com/browse/playlist/" + guid
}

// TODO "https://listen.tidal.com/mix/0104f851efc2d5803c03c6706572aa"
export function getMixURL(id: string): string {
  return "https://tidal.com/browse/mix/" + id
}

function getCacheName(url: string): string {
  const [, type, id] = /([^/]+)\/([^/]+)$/.exec(url)
  return `${id}-${type}.json`
}

export async function importFromURLCached(url: string): Promise<Playlist> {
  const cacheFile = Path.join(CacheFolder, getCacheName(url))
  try {
    return JSON.parse(await FS.readFile(cacheFile, "utf-8"))
  } catch (e) {
    // ignore errors, just refetch
    console.warn(e)
  }
  const tracks = await importFromURL(url)
  const playlist = { url, tracks }
  await FS.writeFile(cacheFile, JSON.stringify(playlist))
  return playlist
}
