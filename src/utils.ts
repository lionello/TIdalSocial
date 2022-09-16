// Like Python's os.getenv() with a default value
export function getenv(key: string, defaultValue: string): string {
  const value = process.env[key]
  return value === undefined ? defaultValue : value
}

// Async sleep function
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
