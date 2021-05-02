import { app } from "./app.js"
import { getArtistURL, importFromURLParsed, setOffline } from "./parse.js"
import { readdir } from "fs/promises"

const { PORT: port = 3000 } = process.env

const server = app.listen(port, function () {
  console.log(`HTTP server started at http://localhost:${this.address().port}`)
})

process.on("SIGTERM", () => {
  server.close(() => {
    console.debug("HTTP server closed")
  })
})

// function isSuperset<T>(set: Set<T>, subset: Iterable<T>): boolean {
//   for (const elem of subset) {
//     if (!set.has(elem)) {
//       return false
//     }
//   }
//   return true
// }

async function bootstrap(url: string) {
  const songs = await importFromURLParsed(url, true)
  console.log(songs.title, "\t", url)
  // for (const track of songs.tracks) {
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

async function main(args: string[]) {
  // setOffline(true)
  // const artists = await readdir("cache/artist")
  // for (const a of artists) {
  //   await bootstrap(getArtistURL(parseInt(a)))
  //   // await bootstrap(getPlaylistURL(guid))
  // }
}

main(process.argv).catch((err) => {
  console.error(err.stack)
  process.exitCode = 1
})
