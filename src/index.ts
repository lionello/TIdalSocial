import { app } from "./app"
import { getArtistURL, importFromURLParsed } from "./parse"

const { PORT: port = 3000 } = process.env

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

async function main(args: string[]) {
  // const songs = await importFromURLParsed(getArtistURL(50))
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

main(process.argv).catch((err) => {
  console.error(err.stack)
  process.exitCode = 1
})
