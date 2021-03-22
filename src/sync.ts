import { VERSION } from "./version.js"

async function getVersion(): Promise<string> {
  const response = await fetch("/version", {
    headers: { "Cache-Control": "no-cache" },
  })
  return response.text()
}

function waitMillis(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function watchVersion(forever: boolean): Promise<void> {
  do {
    let version
    try {
      version = await getVersion()
    } catch {
      // nop
    }
    await waitMillis(2000)
    if (version !== VERSION) window.location.reload()
  } while (forever)
}

watchVersion(true)
