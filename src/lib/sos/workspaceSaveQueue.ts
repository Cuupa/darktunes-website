/** Keep autosave and manual save in order so they cannot race their own revision. */
export function createWorkspaceSaveQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return (save: () => Promise<boolean>): Promise<boolean> => {
    const next = tail.then(save, save)
    tail = next.catch(() => undefined)
    return next
  }
}
