import { assert } from "chai"
import { describe, it } from "mocha"
import { isOffline, setOffline } from "../src/offline.js"

describe("offline", function () {
  it("setOffline", function () {
    const prev = setOffline(false)
    assert.isFalse(isOffline())
    assert.isFalse(setOffline())
    assert.isTrue(isOffline())
    assert.isTrue(setOffline(prev))
    assert.strictEqual(isOffline(), prev)
  })
})
