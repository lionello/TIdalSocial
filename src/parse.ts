import { promises as FS } from "fs"
import * as Path from "path"
import * as jsdom from "jsdom"
import { getRandom } from "random-useragent"

import { Track, TrackList } from "./model"
import { HTTPError, HTTPStatusCode } from "./error.js"
import { isOffline } from "./offline.js"

const PROJECT_ROOT = "."
const STORAGE_FOLDER = process.env.STORAGE_FOLDER || PROJECT_ROOT
const DB_FOLDER = "db"
const CACHE_FOLDER = "cache"
const TIDAL_URL_REGEX = /([^/]+)s?\/([^/]+)$/
const TRIM_REGEX = /^\s+|\s+\[[^\]]+\]|\s+\([^)]+\)|\s+$/g
const BASE_URL = "https://tidal.com/"
const BROWSE_URL_PREFIX = "https://tidal.com/browse/"

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

export function parsePlaylistDocument(playlist?: Document): PageInfo {
  if (!playlist) {
    throw Error("Missing playlist document")
  }
  const title = playlist
    .getElementsByClassName(
      "font-size-large font-size-medium-lg-max margin-bottom-0"
    )[0]
    ?.textContent?.replace(TRIM_REGEX, "")
  const trackItems = Array.from(playlist.getElementsByClassName("track-item has-info"))
  const tracks = trackItems.map((trackItem) => parseTrackItem(trackItem))
  return { title, tracks }
}

function beforeParse(window: jsdom.DOMWindow) {
  window.HTMLCanvasElement.prototype.getContext = () => null
}

class CustomResourceLoader extends jsdom.ResourceLoader {
  fetch(url, options) {
    // if (options.element) {
    //   console.log(`Element ${options.element.localName} is requesting the url ${url}`)
    // } else {
    //   console.log(`Requesting the url ${url}`)
    // }
    if (url.startsWith("https://www.google")) return null
    if (url.startsWith("https://tidal.com/browse/_nuxt/")) return null
    return super.fetch(url, options)
  }
}

const cookieJar = new jsdom.CookieJar()

async function fromURL(url: string): Promise<Document> {
  if (isOffline()) throw new HTTPError("Offline", HTTPStatusCode.NOT_FOUND)

  const resources = new CustomResourceLoader({
    proxy: "http://proxy.tidalsocial.com:9001",
    // strictSSL: false,
  })
  const options: jsdom.BaseOptions = {
    beforeParse,
    cookieJar,
    pretendToBeVisual: true,
    resources,
    // runScripts: "dangerously",
    userAgent: getRandom(),
  }

  try {
    const dom = await jsdom.JSDOM.fromURL(url, options)
    // dom.window.close()
    return dom.window.document
  } catch (err) {
    console.debug(err.statusCode || err.message)
    const e = new jsdom.JSDOM(err.error)
    const msg =
      e.window.document.getElementsByTagName("p")?.item(0)?.textContent || "Not Found"
    throw new HTTPError(msg, err.statusCode)
  }
}

async function importFromURL(url: string): Promise<PageInfo> {
  const document = await fromURL(url)
  return parsePlaylistDocument(document)
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

export function makeBrowseUrl(type: string, id: string): string {
  return BROWSE_URL_PREFIX + type + "/" + id
}

export function getPlaylistURL(guid: string): string {
  return makeBrowseUrl("playlist", guid)
}

export function getMixURL(id: string): string {
  return makeBrowseUrl("mix", id)
}

export function getArtistURL(id: number): string {
  return makeBrowseUrl("artist", id.toString())
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
  // Canonicalize the URL to https://tidal.com/browse/…
  url = makeBrowseUrl(type, id)
  const pageInfo = await importFromURLCached(url)
  const playlist = { id, url, ...pageInfo }
  // Cache this playlist (but only if we actually parsed the tracks)
  if (playlist.tracks.length > 0) {
    await FS.writeFile(jsonFile, JSON.stringify(playlist))
  }
  return playlist
}
