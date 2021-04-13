import { VERSION } from "./version.js"

interface Version {
  VERSION?: string
}

async function getVersionLongPoll(): Promise<Version> {
  const response = await fetch("/version", {
    headers: { "Cache-Control": "no-cache" },
  })
  return response.json()
}

function waitMillis(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function watchVersion(forever: boolean): Promise<void> {
  do {
    let version: Version = {}
    try {
      version = await getVersionLongPoll()
    } catch (e) {
      console.debug(e)
    }
    await waitMillis(1000)
    if (version.VERSION !== VERSION) window.location.reload()
  } while (forever)
}

globalThis.onload = (ev) => watchVersion(true)
