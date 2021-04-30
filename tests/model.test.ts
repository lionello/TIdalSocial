import { assert } from "chai"
import { describe, it } from "mocha"
import { processPlaylist } from "../src/model.js"

describe("model", function () {
  it("processPlaylist", async function () {
    const playlist = await processPlaylist(
      {
        id: "blah",
        tracks: [{ trackName: "Creep", artists: ["Radiohead"] }],
        url: "https://tidal.com/blah",
      },
      { update: false }
    )
    assert.isNotEmpty(playlist.artists)
    assert.isNotEmpty(playlist.playlists)
  })
})
