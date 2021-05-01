import { exec } from "child_process"
import express from "express"
import * as Path from "path"
import { fileURLToPath } from "url"
import { HTTPError, HTTPStatusCode } from "./error.js"
import { processPlaylist } from "./model.js"
import { importFromURLParsed } from "./parse.js"
import { VERSION } from "./version.js"

const SAFE_URL = /^https:\/\/(listen\.|embed\.)?tidal\.com\//
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
  if (!req.accepts("json")) {
    throw new HTTPError("This API returns JSON", HTTPStatusCode.NOT_ACCEPTABLE)
  }
  const { playlist_url } = req.body
  if (typeof playlist_url !== "string" || !SAFE_URL.test(playlist_url)) {
    console.debug(req.body)
    throw new HTTPError("Missing or invalid 'playlist_url'", HTTPStatusCode.BAD_REQUEST)
  }

  importFromURLParsed(playlist_url)
    .then((playlist) => {
      return processPlaylist(playlist)
    })
    .then((response) => {
      console.debug(response)
      res.send(response)
    })
    .catch(next)
})

app.get("/version", (req, res) => {
  const timeout = req.query["timeout"] as string
  const timer = setTimeout(
    () => res.send({ VERSION }),
    1000 * Number.parseInt(timeout || DEFAULT_VERSION_TIMEOUT)
  )
  // Abandon the timer when the client disconnects
  req.on("close", () => clearTimeout(timer))
})

app.use("/js", express.static(makeAbsolute(".")))

app.use(express.static(makeAbsolute("../../static")))

app.get("/py", (req, res, next) => {
  exec(defaultPythonPath + " --version", (err, stdin, stderr) => {
    if (err) next(err)
    else res.send(stdin + stderr)
  })
})

app.use(function (err, req, res, next) {
  if (!err || res.headersSent || !req.accepts("json")) {
    return next(err)
  }
  console.error(err.stack)
  res.status(err.status || err.statusCode || 500).send({ error: err.message })
})
