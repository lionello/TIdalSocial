import * as jsdom from "jsdom"

// function isSuperset<T>(set: Set<T>, subset: Iterable<T>): boolean {
//   for (const elem of subset) {
//     if (!set.has(elem)) {
//       return false
//     }
//   }
//   return true
// }

interface Song {
  trackName: string
  artists: string[]
  albumTitle: string
}

const removeParens = / \[[^\]]+\]| \([^)]+\)/g

function parseTrackItem(trackItem: Element): Song {
  const trackInfo = trackItem.getElementsByClassName("track-name")[0]
  const trackName = trackInfo
    .getElementsByTagName("a")[0]
    .firstChild.textContent.trim()
    .replace(removeParens, "")
  const artistList = trackInfo.getElementsByClassName("artist-list")[0]
  const artists: string[] = []
  for (const artist of artistList.getElementsByTagName("a")) {
    artists.push(artist.textContent.trim())
  }
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

function parsePlaylist(playlist: Document): Song[] {
  const trackItems = playlist.getElementsByClassName("track-item has-info")
  const songs: Song[] = []
  for (const trackItem of trackItems) {
    songs.push(parseTrackItem(trackItem))
  }
  return songs
}

// same song: +3
// song same album: +2
// song from same artist: +1

async function main() {
  const dom = await jsdom.JSDOM.fromURL(
    "https://tidal.com/browse/playlist/35a94f27-440d-4504-b9f3-fe3d0e6895bd"
    // "https://tidal.com/browse/playlist/6ec29a72-53a6-492b-bb75-97f0f13a659f"
  )

  for (const track of parsePlaylist(dom.window.document)) {
    console.log(
      track.trackName,
      "|",
      track.artists.join(","),
      "|",
      track.albumTitle
    )
  }
}

main().catch((err) => {
  console.error(err.stack)
  process.exitCode = 1
})
