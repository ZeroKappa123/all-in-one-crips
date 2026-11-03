// Where the game data files come from: the main process in the app, the file system in tests.
export interface DataLoader {
  text(path: string): Promise<string>
  binary(path: string): Promise<ArrayBuffer>
}

let loader: DataLoader | null = null
export function setDataLoader(l: DataLoader): void { loader = l }
export function dataLoader(): DataLoader {
  if (!loader) throw new Error('data loader not set')
  return loader
}
