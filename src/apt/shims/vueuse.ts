export function createGlobalState<T>(factory: () => T): () => T {
  let state: T | undefined
  return () => (state ??= factory())
}
