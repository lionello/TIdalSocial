import { JSDOM } from "jsdom"
import { promises as FS } from "fs"
import * as Path from "path"
import { Song, parsePlaylistDocument } from "./parse"
import { app } from "./app"

const { PORT: port = 3000 } = process.env
const CacheFolder = "cache"

app.listen(port, function () {
  console.log(`server started at http://localhost:${this.address().port}`)
})

// function isSuperset<T>(set: Set<T>, subset: Iterable<T>): boolean {
//   for (const elem of subset) {
//     if (!set.has(elem)) {
//       return false
//     }
//   }
//   return true
// }

const playlists = [
  "6ec29a72-53a6-492b-bb75-97f0f13a659f",
  "131786bd-e063-448b-9d9a-7ad8e029835a",

  "aaceef9b-6746-44ec-b916-705a63a7f13a",
  "2af2baf5-8b21-4428-b12e-9a37809d093a",
  "895594ec-011a-4fff-964c-1007628071b5",
  "5e76c6c2-ed06-4126-8d7f-a0bd6a9a091d",
  "0e6090f3-c4a3-4dc4-b682-05219d8a5495",
  "59609d49-1985-4328-b3fc-1bb5d7bc80df",
  "4e8bc90f-497e-45ac-a444-5ecf72d7271b",
  "c24c3c65-fb79-4ba7-90af-7631466d5c24",
  "44fc5bed-9251-41f1-a0f1-ce304fa0aeff",
  "46eafb25-0264-4943-9c79-80b871308615",
  "d95f3894-f07d-4f87-adba-02fb2a7b5c0e",
  "da8d1c11-af63-4e09-b67c-2ca92fd7172c",
  "c47a7551-4998-4c15-9911-7c79156108a6",
  "b5f34d0c-d078-4822-8a0d-457de05e5cb5",
  "35a94f27-440d-4504-b9f3-fe3d0e6895bd",
  "59a8628b-9bb1-4a21-8e3e-b876c6600287",
  "697e7d0c-1863-4198-aeb6-c69a66d67bba",
  "d9332ea1-53f8-4d14-84ea-2e8830b57a09",
  "e91feec0-8d1c-48c5-9178-dd25c703a6ca",
  "ed06c151-94fc-4ad7-88d5-a83c39fe62fd",
]

async function importFromURL(url: string): Promise<Song[]> {
  const dom = await JSDOM.fromURL(url) // , { runScripts: "dangerously" })
  return parsePlaylistDocument(dom.window.document)
}

function getPlaylistURL(guid: string): string {
  return "https://tidal.com/browse/playlist/" + guid
}

// TODO "https://listen.tidal.com/mix/0104f851efc2d5803c03c6706572aa"
function getMixURL(id: string): string {
  return "https://tidal.com/browse/mix/" + id
}

function getCacheName(url: string): string {
  const [, type, id] = /([^/]+)\/([^/]+)$/.exec(url)
  return `${id}-${type}.json`
}

async function importFromURLCached(url: string): Promise<Song[]> {
  const cacheFile = Path.join(CacheFolder, getCacheName(url))
  try {
    return JSON.parse(await FS.readFile(cacheFile, "utf-8"))
  } catch (e) {
    // ignore errors, just refetch
    console.warn(e)
  }
  const songs = await importFromURL(url)
  await FS.writeFile(cacheFile, JSON.stringify(songs))
  return songs
}

async function main() {
  for (const guid of playlists) {
    const songs = await importPlaylistCached(guid)
    // for (const track of songs) {
    //   console.log(
    //     track.trackName,
    //     "|",
    //     track.artists.join(","),
    //     "|",
    //     track.albumTitle
    //     // track.artists.map((a) => Artists[a.toLowerCase()])
    //   )
    // }
  }
}

main().catch((err) => {
  console.error(err.stack)
  process.exitCode = 1
})
