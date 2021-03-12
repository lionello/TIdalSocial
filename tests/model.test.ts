import { assert } from "chai"
import { describe } from "mocha"
import { process_playlist } from "../src/model"

describe("model", function () {
  it("process_playlist", async function () {
    const playlist = await process_playlist(
      {
        tracks: [{ trackName: "Creep", artists: ["Radiohead"] }],
        url: "https://tidal.com/blah",
      },
      { update: false }
    )
    assert.isNotEmpty(playlist.artists)
    assert.isNotEmpty(playlist.playlists)
  })
})
