import { assert } from "chai"
import { describe, it, before } from "mocha"
import {
  importFromURLParsed,
  getPlaylistURL,
  getArtistURL,
  getMixURL,
  setOffline,
} from "../src/parse.js"

const PLAYLIST_IDS = [
  "6ec29a72-53a6-492b-bb75-97f0f13a659f",
  "131786bd-e063-448b-9d9a-7ad8e029835a",

  "aaceef9b-6746-44ec-b916-705a63a7f13a",
  "2af2baf5-8b21-4428-b12e-9a37809d093a",
  "895594ec-011a-4fff-964c-1007628071b5",
  "5e76c6c2-ed06-4126-8d7f-a0bd6a9a091d",
  "0e6090f3-c4a3-4dc4-b682-05219d8a5495",
  "59609d49-1985-4328-b3fc-1bb5d7bc80df",
  "4e8bc90f-497e-45ac-a444-5ecf72d7271b",
  "c24c3c65-fb79-4ba7-90af-7631466d5c24",
  "44fc5bed-9251-41f1-a0f1-ce304fa0aeff",
  "46eafb25-0264-4943-9c79-80b871308615",
  "d95f3894-f07d-4f87-adba-02fb2a7b5c0e",
  "da8d1c11-af63-4e09-b67c-2ca92fd7172c",
  "c47a7551-4998-4c15-9911-7c79156108a6",
  "b5f34d0c-d078-4822-8a0d-457de05e5cb5",
  "35a94f27-440d-4504-b9f3-fe3d0e6895bd",
  "59a8628b-9bb1-4a21-8e3e-b876c6600287",
  "697e7d0c-1863-4198-aeb6-c69a66d67bba",
  "d9332ea1-53f8-4d14-84ea-2e8830b57a09",
  "e91feec0-8d1c-48c5-9178-dd25c703a6ca",
  "ed06c151-94fc-4ad7-88d5-a83c39fe62fd",
]

describe("parse", function () {
  before(function () {
    setOffline(true)
  })

  it("getPlaylistURL", function () {
    assert.equal(getPlaylistURL("xy"), "https://tidal.com/browse/playlist/xy")
  })

  it("getArtistURL", function () {
    assert.equal(getArtistURL(42), "https://tidal.com/browse/artist/42")
  })

  it("getMixURL", function () {
    assert.equal(getMixURL("foo"), "https://tidal.com/browse/mix/foo")
  })

  for (const guid of PLAYLIST_IDS) {
    it("parse playlist " + guid, async function () {
      const url = getPlaylistURL(guid)
      const songs = await importFromURLParsed(url)
      assert.isNotEmpty(songs.tracks)
      assert.strictEqual(songs.url, url)
    })
  }

  it("parse artist", async function () {
    const url = getArtistURL(50)
    const songs = await importFromURLParsed(url)
    assert.isNotEmpty(songs.tracks)
    assert.strictEqual(songs.url, url)
  })
})
