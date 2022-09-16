import { assert } from "chai"
import { describe, it, before, after } from "mocha"
import { setOffline } from "../src/offline.js"
import {
  importFromURLParsed,
  getPlaylistURL,
  getArtistURL,
  getMixURL,
  HTTPS_PROXY,
} from "../src/parse.js"

const PLAYLIST_IDS = [
  "6ec29a72-53a6-492b-bb75-97f0f13a659f",
  "131786bd-e063-448b-9d9a-7ad8e029835a",
  "3751614e-3827-4860-819c-b9474a000dbb",
]

describe("parse", function () {
  it("getPlaylistURL", function () {
    assert.equal(getPlaylistURL("xy"), "https://tidal.com/browse/playlist/xy")
  })

  it("getArtistURL", function () {
    assert.equal(getArtistURL(42), "https://tidal.com/browse/artist/42")
  })

  it("getMixURL", function () {
    assert.equal(getMixURL("foo"), "https://tidal.com/browse/mix/foo")
  })

  describe(`https_proxy=${HTTPS_PROXY}`, function () {
    for (const url of [
      "tidal.com/browse/playlist/b02d5fef-afed-4fd7-9d61-f74a5058e501",
      "https://listen.tidal.com/playlist/b02d5fef-afed-4fd7-9d61-f74a5058e501",
      "https://tidal.com/browse/playlist/b02d5fef-afed-4fd7-9d61-f74a5058e501",
    ]) {
      it(`parse URL ${url}`, async function () {
        const songs = await importFromURLParsed(url, true)
        assert.isNotEmpty(songs.tracks)
        assert.isNotEmpty(songs.url)
        assert.strictEqual(songs.id, "b02d5fef-afed-4fd7-9d61-f74a5058e501")
      })
    }
  })

  describe("from cache", function () {
    let prevMode: boolean

    before(function () {
      prevMode = setOffline(true)
    })

    after(function () {
      assert.isTrue(setOffline(prevMode))
    })

    for (const guid of PLAYLIST_IDS) {
      it("parse playlist " + guid, async function () {
        const url = getPlaylistURL(guid)
        const songs = await importFromURLParsed(url)
        assert.isNotEmpty(songs.tracks)
        assert.strictEqual(songs.url, url)
        assert.strictEqual(songs.id, guid)
      })
    }

    it("parse artist", async function () {
      const url = getArtistURL(50)
      const songs = await importFromURLParsed(url)
      assert.isNotEmpty(songs.tracks)
      assert.strictEqual(songs.url, url)
      assert.strictEqual(songs.id, "50")
    })
  })
})
