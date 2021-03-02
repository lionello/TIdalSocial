import { describe } from "mocha"

import { app } from "../src/app"
import request from "supertest"

describe("app", function () {
  for (const resource of ["/", "/js/parse.js", "/js/parse.js.map"]) {
    it("GET " + resource, function (done) {
      request(app).get(resource).expect(200).end(done)
    })
  }

  it("POST /url", function (done) {
    request(app)
      .post("/url")
      .send("playlist_url=https://google.com")
      .expect(302)
      .expect("Location", "/")
      .end(done)
  })
})
