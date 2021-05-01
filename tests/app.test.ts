import { describe, it } from "mocha"
import request from "supertest"
import { app } from "../src/app.js"
import { VERSION } from "../src/version.js"

describe("app", function () {
  describe("GET (static)", function () {
    for (const path of [
      "/",
      "/js/parse.js",
      "/js/sync.js",
      "/js/version.js",
      "/components/Tidal.vue",
    ]) {
      it(path, function (done) {
        request(app).get(path).expect(200).end(done)
      })

      if (path.endsWith(".js")) {
        it(path + ".map", function (done) {
          request(app)
            .get(`${path}.map`)
            .expect("Content-Type", /^application\/json/)
            .expect(200)
            .end(done)
        })
      }
    }
  })

  describe("POST /url", function () {
    for (const url of [
      // "3751614e-3827-4860-819c-b9474a000dbb", // implicit playlist
      "https://tidal.com/browse/playlist/3751614e-3827-4860-819c-b9474a000dbb",
      "https://listen.tidal.com/playlist/3751614e-3827-4860-819c-b9474a000dbb",
      "https://embed.tidal.com/playlist/3751614e-3827-4860-819c-b9474a000dbb",
      // "0104f851efc2d5803c03c6706572aa", // implicit mix
      "https://tidal.com/browse/mix/0104f851efc2d5803c03c6706572aa",
      "https://listen.tidal.com/mix/0104f851efc2d5803c03c6706572aa",
      "https://embed.tidal.com/mix/0104f851efc2d5803c03c6706572aa",
    ]) {
      it(url, function (done) {
        request(app)
          .post("/url")
          .send("playlist_url=" + encodeURIComponent(url))
          .redirects(0)
          .expect("Content-Type", /^application\/json/)
          .expect(200)
          .end(done)
      })
    }

    for (const body of [
      "",
      "playlist_url=not_a_url",
      "wrong=https%3A%2F%2Ftidal.com%2Fplaylist%2F12341234-1234-1234",
    ]) {
      it(body, function (done) {
        request(app)
          .post("/url")
          .send(body)
          .expect("Content-Type", /^application\/json/)
          .expect(400, { error: "Missing or invalid 'playlist_url'" })
          .end(done)
      })
    }

    it("404", function (done) {
      request(app)
        .post("/url")
        .send("playlist_url=https%3A%2F%2Ftidal.com%2Fplaylist%2F12341234-1234-1234")
        .expect("Content-Type", /^application\/json/)
        .expect(404, { error: "Not Found" })
        .end(done)
    })
  })

  describe("GET /version", function () {
    it("default (long-poll)", function (done) {
      request(app)
        .get("/version")
        .timeout(900)
        .end((err) => {
          done(
            err && /Timeout of \d+ms exceeded/.test(err.message)
              ? undefined
              : err || Error("Long-poll completed prematurely")
          )
        })
    })

    it("no timeout", function (done) {
      request(app)
        .get("/version?timeout=0")
        .expect("Content-Type", /^application\/json/)
        .expect(200, { VERSION })
        .end(done)
    })

    it("with timeout", function (done) {
      request(app)
        .get("/version?timeout=1")
        .expect("Content-Type", /^application\/json/)
        .expect(200, { VERSION })
        .end(done)
    })
  })
})
