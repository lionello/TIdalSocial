import { promises as FS } from "fs"
import * as Path from "path"
import * as jsdom from "jsdom"
import { Track, TrackList } from "./model"

const PROJECT_ROOT = "."
const STORAGE_FOLDER = process.env.STORAGE_FOLDER || PROJECT_ROOT
const DB_FOLDER = "db"
const CACHE_FOLDER = "cache"
const TIDAL_URL_REGEX = /([^/]+)\/([^/]+)$/
const TRIM_REGEX = /^\s+|\s+\[[^\]]+\]|\s+\([^)]+\)|\s+$/g
const BASE_URL = "https://tidal.com/"

let offlineMode = false

export function setOffline(offline = true): void {
  offlineMode = offline
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

type PageInfo = {
  title?: string
  tracks: Track[]
}

export function parsePlaylistDocument(playlist: Document): PageInfo {
  const title = playlist
    .getElementsByClassName(
      "font-size-large font-size-medium-lg-max margin-bottom-0"
    )[0]
    ?.textContent?.replace(TRIM_REGEX, "")
  const trackItems = Array.from(
    playlist.getElementsByClassName("track-item has-info")
  )
  const tracks = trackItems.map((trackItem) => parseTrackItem(trackItem))
  return { title, tracks }
}

async function importFromURL(url: string): Promise<PageInfo> {
  if (offlineMode) throw new Error("Parser is in offline mode")
  const dom = await jsdom.JSDOM.fromURL(url)
  return parsePlaylistDocument(dom.window.document)
}

function importFromString(html: string): PageInfo {
  const dom = new jsdom.JSDOM(html)
  return parsePlaylistDocument(dom.window.document)
}

function removeHTTPHeaders(html: string): string {
  return html.replace(/^HTTP\/1\.1 .+\r\n\r\n/s, "")
}

async function importFromURLCached(url: string): Promise<PageInfo> {
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

function getJsonCacheName(type: string, id: string): string {
  return Path.join(STORAGE_FOLDER, DB_FOLDER, type, `${id}-${type}.json`)
}

function getHtmlCacheName(url: string): string {
  const [match] = TIDAL_URL_REGEX.exec(url)!
  return Path.join(STORAGE_FOLDER, CACHE_FOLDER, match)
}

export async function importFromURLParsed(
  url: string,
  force = false
): Promise<TrackList> {
  const [, type, id] = TIDAL_URL_REGEX.exec(url)!
  const jsonFile = getJsonCacheName(type, id)
  if (!force) {
    try {
      const cacheContents = await FS.readFile(jsonFile, "utf-8")
      return JSON.parse(cacheContents)
    } catch (e) {
      // ignore errors, just refetch
      console.warn(e)
    }
  }
  const pageInfo = await importFromURLCached(url)
  const playlist = { id, url, ...pageInfo }
  await FS.writeFile(jsonFile, JSON.stringify(playlist))
  return playlist
}
