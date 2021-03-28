import { assert } from "chai"
import { describe } from "mocha"
import request from "supertest"
import { app } from "../src/app.js"
import { VERSION } from "../src/version.js"

// import "mocha"
// import request from "supertest"
// import * as VERSION from "../src/version"
// import { app } from "../src/app"

describe("app", function () {
  for (const path of [
    "/",
    "/js/parse.js",
    "/js/sync.js",
    "/js/version.js",
    "/components/Tidal.vue",
  ]) {
    it("GET " + path, function (done) {
      request(app).get(path).expect(200).end(done)
    })

    if (path.endsWith(".js")) {
      it("GET " + path + ".map", function (done) {
        request(app).get(`${path}.map`).expect(200).end(done)
      })
    }
  }

  it("POST /url", function (done) {
    request(app)
      .post("/url")
      .send(
        "playlist_url=https://tidal.com/browse/playlist/3751614e-3827-4860-819c-b9474a000dbb"
      )
      .expect(302)
      .expect("Location", "/")
      .end(done)
  })

  describe("GET /version", function () {
    it("default (long-poll)", function (done) {
      request(app)
        .get("/version")
        .timeout(900) //.end(done)
        .end((err) => {
          done(err ? undefined : Error("x"))
        })
    })

    it("no timeout", function (done) {
      request(app).get("/version?timeout=0").expect(200, VERSION).end(done)
    })

    it("with timeout", function (done) {
      request(app).get("/version?timeout=1").expect(200, VERSION).end(done)
    })
  })
})
