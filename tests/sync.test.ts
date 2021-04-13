global.window = {}
import chai, { expect } from "chai"
import spies from "chai-spies"
import { describe, it } from "mocha"
import { watchVersion } from "../src/sync.js"
import { VERSION } from "../src/version.js"

chai.use(spies)

declare let global: any

function mockFetch(json_or_error: any) {
  return async (url: string, init?: RequestInit) => ({
    json: async () => {
      if (json_or_error instanceof Error) throw json_or_error
      return json_or_error
    },
  })
}

describe("sync", function () {
  const tests = [
    {
      name: "watchVersion (happy path)",
      json: { VERSION },
      reload: 0,
    },
    {
      name: "watchVersion (reload)",
      json: { VERSION: "invalid" },
      reload: 1,
    },
    {
      name: "watchVersion (reload on error)",
      json: TypeError("a"),
      reload: 1,
    },
  ]

  for (const test of tests) {
    it(test.name, async function () {
      const reload = chai.spy()
      global.window.location = { reload }
      const fetch = chai.spy(mockFetch(test.json))
      global.fetch = fetch
      await watchVersion(false)
      expect(fetch).to.have.been.called.once.with("/version")
      expect(reload).to.have.been.called.exactly(test.reload)
    })
  }
})
