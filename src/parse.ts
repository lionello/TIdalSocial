export interface Song {
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

export function parsePlaylistDocument(playlist: Document): Song[] {
  const trackItems = Array.from(
    playlist.getElementsByClassName("track-item has-info")
  )
  return trackItems.map((trackItem) => parseTrackItem(trackItem))
}
