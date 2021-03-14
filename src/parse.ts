import { promises as FS } from "fs"
import * as Path from "path"
import { JSDOM } from "jsdom"
import { TrackList } from "./model"

const DB_FOLDER = "db"
const CACHE_FOLDER = "cache"
const TIDAL_URL_REGEX = /([^/]+)\/([^/]+)$/
const TRIM_REGEX = /^\s+|\s+\[[^\]]+\]|\s+\([^)]+\)|\s+$/g
const BASE_URL = "https://tidal.com/"

let offlineMode = false

export function setOffline(offline = true): void {
  offlineMode = offline
}

export interface Track {
  trackName: string
  trackUrl?: string
  artists: string[]
  // artistUrls?: string[]
  albumTitle?: string
  albumUrl?: string
}

function makeAbs(url: string): string {
  return new URL(url, BASE_URL).href
}

// From https://stackoverflow.com/a/46700791/2017049
function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

function parseTrackItem(trackItem: Element): Track {
  const trackInfo = trackItem.getElementsByClassName("track-name")[0]
  const trackNameA = trackInfo.getElementsByTagName("a")[0]
  const trackName = trackNameA.firstChild!.textContent!.replace(TRIM_REGEX, "")
  const trackUrl = makeAbs(trackNameA.href)
  const artistList = trackInfo.getElementsByClassName("artist-list")[0]
  const artists = Array.from(artistList.getElementsByTagName("a"))
    .map((artist) => artist.textContent?.replace(TRIM_REGEX, ""))
    .filter(notEmpty)
  const secondaryTitle = trackItem.getElementsByClassName("secondary-title")[0]
  const albumA = secondaryTitle.getElementsByTagName("a")[0]
  const albumUrl = albumA ? makeAbs(albumA.href) : undefined
  const albumTitle = albumA?.firstChild?.textContent?.replace(TRIM_REGEX, "")
  return {
    trackName,
    trackUrl,
    artists,
    albumTitle,
    albumUrl,
  }
}

export function parsePlaylistDocument(playlist: Document): Track[] {
  const trackItems = Array.from(
    playlist.getElementsByClassName("track-item has-info")
  )
  return trackItems.map((trackItem) => parseTrackItem(trackItem))
}

async function importFromURL(url: string): Promise<Track[]> {
  if (offlineMode) throw new Error("Parser is in offline mode")
  const dom = await JSDOM.fromURL(url)
  return parsePlaylistDocument(dom.window.document)
}

function importFromString(html: string): Track[] {
  const dom = new JSDOM(html)
  return parsePlaylistDocument(dom.window.document)
}

function removeHTTPHeaders(html: string): string {
  return html.replace(/^HTTP\/1\.1 .+\r\n\r\n/s, "")
}

async function importFromURLCached(url: string): Promise<Track[]> {
  try {
    const htmlFile = getHtmlCacheName(url)
    const html = await FS.readFile(htmlFile, "utf-8")
    // TODO: use the etag and/or last-modified header to check for updates
    return importFromString(removeHTTPHeaders(html))
  } catch (e) {
    // No such file or corrupt cache entry; fetch from URL
    console.warn(e)
    // TODO: write raw fetched HTML into cache
    return importFromURL(url)
  }
}

export function getPlaylistURL(guid: string): string {
  return "https://tidal.com/browse/playlist/" + guid
}

// TODO "https://tidal.com/browse/mix/0104f851efc2d5803c03c6706572aa"
export function getMixURL(id: string): string {
  return "https://tidal.com/browse/mix/" + id
}

export function getArtistURL(id: number): string {
  return "https://tidal.com/browse/artist/" + id
}

function getJsonCacheName(url: string): string {
  const [, type, id] = TIDAL_URL_REGEX.exec(url)!
  return Path.join(DB_FOLDER, type, `${id}-${type}.json`)
}

function getHtmlCacheName(url: string): string {
  const [match] = TIDAL_URL_REGEX.exec(url)!
  return Path.join(CACHE_FOLDER, match)
}

export async function importFromURLParsed(url: string): Promise<TrackList> {
  const jsonFile = getJsonCacheName(url)
  try {
    const cacheContents = await FS.readFile(jsonFile, "utf-8")
    return JSON.parse(cacheContents)
  } catch (e) {
    // ignore errors, just refetch
    console.warn(e)
  }
  const tracks = await importFromURLCached(url)
  const playlist = { url, tracks }
  await FS.writeFile(jsonFile, JSON.stringify(playlist))
  return playlist
}
