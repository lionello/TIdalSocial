import express from "express"
import * as Path from "path"
import helmet from "helmet"
import { importFromURLCached } from "./parse"

const SafeURL = "https://tidal.com/browse/"

export const app = express()

function makeAbsolute(relative: string): string {
  return Path.join(__dirname, relative)
}

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": [
        "'self'",
        "'sha256-sRy9k0XSEbgeE9touQ/hMzLHvpQhL+U2v3+dl0kWNUM='",
      ],
    },
  })
)

app.post("/url", express.urlencoded({ extended: true }), (req, res, next) => {
  console.log(req.body)
  const playlist_url = req.body.playlist_url
  if (typeof playlist_url !== "string" || playlist_url.startsWith(SafeURL)) {
    res.status(400).send("Not a Tidal URL")
  } else {
    importFromURLCached(playlist_url)
      .then((songs) => {
        console.log(songs)
        res.redirect("/")
      })
      .catch(next)
  }
})

app.use("/js", express.static(makeAbsolute("../dist")))

app.get("/", (req, res) => {
  res.sendFile(makeAbsolute("../model/static/index.html"))
})
