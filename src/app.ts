import { exec } from "child_process"
import express from "express"
import helmet from "helmet"
import * as Path from "path"
import qs from "qs"
import { fileURLToPath } from "url"

import { HTTPError, HTTPStatusCode } from "./error.js"
import {
  processPlaylist,
  defaultPythonPath,
  UNKNOWN_ARTIST_MIX,
  ping,
} from "./model.js"
import { importFromURLParsed } from "./parse.js"
import { VERSION } from "./version.js"
import { verify } from "./hashcash.js"
import NodeCache from "node-cache"

const SAFE_URL = /^(https:\/\/)?(listen\.|embed\.)?tidal\.com\/(browse\/)?(playlists?|artist|mix)\/.+$/
const DEFAULT_VERSION_TIMEOUT = "60"

// Cache recommendation responses for 1 hour to lessen the load on the ML model
const urlCache = new NodeCache({ stdTTL: 60 * 60, useClones: false })

export const app = express()

function dirname(): string {
  // From https://stackoverflow.com/a/50052194/2017049
  return typeof __dirname === "undefined"
    ? Path.dirname(fileURLToPath(import.meta.url))
    : __dirname
}

function makeAbsolute(relative: string): string {
  return Path.join(dirname(), relative)
}

function safeSetTimeout(
  req,
  callback: (...args: any[]) => void,
  ms?: number,
  ...args: any[]
): void {
  const timer = setTimeout(callback, ms, ...args)
  // Abandon the timer when the client disconnects
  req.on("close", () => clearTimeout(timer))
}

app.use(helmet({ contentSecurityPolicy: false }))

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

function verifyOrDelay(req, res, next) {
  if (verify(req.body)) {
    // HashCash verification passed; proceed
    next()
    return
  }
  // HashCash verification failed; delay the client 2s
  safeSetTimeout(req, next, 2000)
}

app.post(
  "/url",
  express.text({ limit: 200, type: "application/x-www-form-urlencoded" }),
  verifyOrDelay,
  (req, res, next) => {
    if (!req.accepts("json")) {
      throw new HTTPError("This API returns JSON", HTTPStatusCode.NOT_ACCEPTABLE)
    }

    const { playlist_url, url, date, update = "1" } = qs.parse(req.body)

    if (url) {
      // A bot likely filled the hidden url input field; ghost it
      res.send({ playlists: [UNKNOWN_ARTIST_MIX] })
      return
    }

    const deltaMs = Math.abs(Date.parse(date as string) - Date.now())
    if (deltaMs > 5 * 60 * 1000 || isNaN(deltaMs)) {
      throw new HTTPError("Time skew too large", HTTPStatusCode.FORBIDDEN)
    }

    if (typeof playlist_url !== "string" || !SAFE_URL.test(playlist_url)) {
      console.debug("Invalid body:", req.body)
      throw new HTTPError("Invalid 'playlist_url'", HTTPStatusCode.BAD_REQUEST)
    }

    const cachedResponse = urlCache.get(playlist_url)
    if (cachedResponse === undefined) {
      importFromURLParsed(playlist_url)
        .then((playlist) => processPlaylist(playlist, { update: !!update }))
        .then((rec) => {
          console.debug("Recommendation:", rec)
          rec.playlists = rec.playlists || [UNKNOWN_ARTIST_MIX]
          urlCache.set(playlist_url, rec)
          res.send(rec)
        })
        .catch(next)
    } else {
      // Return the cached response as is
      res.send(cachedResponse)
    }
  }
)

app.get("/version", (req, res) => {
  const timeout = req.query["timeout"] as string
  safeSetTimeout(
    req,
    () => res.send({ VERSION }),
    1000 * Number.parseInt(timeout || DEFAULT_VERSION_TIMEOUT)
  )
})

app.use("/js", express.static(makeAbsolute(".")))

app.use(express.static(makeAbsolute("../../static")))

app.post("/py", (req, res, next) => {
  exec(defaultPythonPath + " --version", (err, stdin, stderr) => {
    if (err) next(err)
    else res.send(stdin + stderr)
  })
})

app.get("/health", (req, res, next) => {
  ping()
    .then(() => {
      res.status(204).send()
    })
    .catch(next)
})

// Custom error handler
app.use(function (err, req, res, next) {
  if (!err || res.headersSent || !req.accepts("json")) {
    return next(err)
  }
  console.error(err.stack || err)
  res.status(err.status || err.statusCode || 500).send({ error: err.message })
})
