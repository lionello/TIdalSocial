import { assert } from "chai"
import { describe, it } from "mocha"

import { ping, processPlaylist, saveModel } from "../src/model.js"

describe("model", function () {
  it("processPlaylist", async function () {
    const playlist = await processPlaylist(
      {
        id: "blah",
        tracks: [{ trackName: "Creep", artists: ["Radiohead"] }],
        url: "https://tidal.com/blah",
      },
      { update: false, recommend: true }
    )
    assert.isNotEmpty(playlist.artists)
    assert.isNotEmpty(playlist.playlists)
  })

  it("saveModel", async function () {
    await saveModel()
  })

  it("ping", async function () {
    await ping()
  })
})
