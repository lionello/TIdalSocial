import { app } from "./app.js"
import { importFromURLParsed } from "./parse.js"
import {
  ChildProcess,
  spawn,
  SpawnOptions,
  exec,
  execSync,
} from "child_process"

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

async function bootstrap(url: string) {
  const songs = await importFromURLParsed(url)
  for (const track of songs.tracks) {
    console.log(
      track.trackName,
      "|",
      track.artists.join(","),
      "|",
      track.albumTitle
      // track.artists.map((a) => Artists[a.toLowerCase()])
    )
  }
}

async function main(args: string[]) {
  console.log(execSync("py --version").toString())
  console.log(execSync("python3 --version").toString())
  // for (const guid of PLAYLISTS) {
  //   await bootstrap(getPlaylistURL(guid))
  // }
}

main(process.argv).catch((err) => {
  console.error(err.stack)
  process.exitCode = 1
})
