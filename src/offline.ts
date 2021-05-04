let offlineMode = !!process.env["OFFLINE"]

export function setOffline(offline = true): boolean {
  const prevMode = offlineMode
  offlineMode = offline
  return prevMode
}

export function isOffline(): boolean {
  return offlineMode
}
