import { exec } from "child_process"
import express from "express"
import * as Path from "path"
import { fileURLToPath } from "url"
import { processPlaylist } from "./model.js"
import { importFromURLParsed } from "./parse.js"
import { VERSION } from "./version.js"

const SAFE_URL = "https://tidal.com/browse/"
const DEFAULT_VERSION_TIMEOUT = "60"

export const app = express()
const defaultPythonPath = process.platform != "win32" ? "python3" : "py"

function dirname(): string {
  // From https://stackoverflow.com/a/50052194/2017049
  return typeof __dirname === "undefined"
    ? Path.dirname(fileURLToPath(import.meta.url))
    : __dirname
}

function makeAbsolute(relative: string): string {
  console.log(dirname())
  return Path.join(dirname(), relative)
}

// app.use(helmet())

// app.use(
//   helmet.contentSecurityPolicy({
//     directives: {
//       ...helmet.contentSecurityPolicy.getDefaultDirectives(),
//       "script-src": [
//         "'self'",
//         "'sha256-sRy9k0XSEbgeE9touQ/hMzLHvpQhL+U2v3+dl0kWNUM='",
//       ],
//     },
//   })
// )

app.post("/url", express.urlencoded({ extended: true }), (req, res, next) => {
  const playlist_url = req.body.playlist_url
  if (typeof playlist_url !== "string" || !playlist_url.startsWith(SAFE_URL)) {
    res.status(400).send("Not a Tidal URL")
  } else {
    importFromURLParsed(playlist_url)
      .then((playlist) => {
        return processPlaylist(playlist)
      })
      .then((response) => {
        console.debug(response)
        if (!req.accepts("json")) {
          res.sendStatus(406)
        } else {
          res.send(response)
        }
      })
      .catch(next)
  }
})

app.get("/version", (req, res) => {
  const timeout = req.query["timeout"] as string
  const timer = setTimeout(
    () => res.send(VERSION),
    1000 * Number.parseInt(timeout || DEFAULT_VERSION_TIMEOUT)
  )
  // Abandon the timer when the client disconnects
  req.on("close", () => clearTimeout(timer))
})

app.use("/js", express.static(makeAbsolute(".")))

app.use(express.static(makeAbsolute("../../static")))

app.get("/py", (req, res) => {
  exec(defaultPythonPath + " --version", (err, stdin, stderr) => {
    if (err) res.status(500).send(err.message)
    else res.send(stdin + stderr)
  })
})
