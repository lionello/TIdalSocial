import express from "express"
import * as Path from "path"
import helmet from "helmet"

export const app = express()

function makeAbsolute(relative: string): string {
  return Path.join(__dirname, relative)
}

app.use(helmet())

app.post("/url", express.urlencoded({ extended: true }), (req, res) => {
  console.log(req.body)
  res.redirect("/")
})

app.use("/js", express.static(makeAbsolute("dist")))

app.get("/", (req, res) => {
  res.sendFile(makeAbsolute("model/static/index.html"))
})
