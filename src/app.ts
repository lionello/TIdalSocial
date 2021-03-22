import express from "express"
import * as Path from "path"
import { processPlaylist } from "./model.js"
import { importFromURLParsed } from "./parse.js"
import { VERSION } from "./version.js"

const SAFE_URL = "https://tidal.com/browse/"
const DEFAULT_VERSION_TIMEOUT = "60"

export const app = express()

function dirname(): string {
  return typeof __dirname === "undefined"
    ? "/Users/llunesu/tidalsocial/dist" // FIXME
    : __dirname
}

function makeAbsolute(relative: string): string {
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

app.use("/js/components", express.static(makeAbsolute("../src/components")))

app.use("/js", express.static(makeAbsolute("../dist/src")))

app.use(express.static(makeAbsolute("../model/static")))
