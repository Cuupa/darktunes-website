/**
 * src/workers/index.ts
 *
 * Main-thread utilities for spawning and communicating with the Web Workers
 * defined in this directory.
 *
 * Workers are lazily instantiated — the Worker is created the first time it
 * is needed and should be terminated when the owning component unmounts.
 *
 * Next.js / Webpack note:
 *   Import workers with `new Worker(new URL('./foo.worker.ts', import.meta.url))`
 *   so Webpack can bundle them as separate chunks.  The helpers below wrap
 *   this pattern and provide a typed, Promise-based API.
 *
 * Usage:
 *   const processor = createImageProcessorWorker()
 *   const result = await processor.resize(bitmap, 400, 400)
 *   if (result.ok) console.log(result.blob)
 *   processor.terminate()
 */

import type {
  ImageWorkerMessage,
  ImageWorkerResponse,
} from './imageProcessor.worker'

// ---------------------------------------------------------------------------
// Generic worker wrapper
// ---------------------------------------------------------------------------

/**
 * Sends a single message to a Worker and resolves with the first response.
 * The message is sent with transferable objects to avoid copying large payloads.
 */
function sendToWorker<Msg, Res>(
  worker: Worker,
  message: Msg,
  transfer: Transferable[] = [],
): Promise<Res> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<Res>) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      resolve(e.data)
    }
    const onError = (e: ErrorEvent) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(new Error(e.message))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage(message, transfer)
  })
}

// ---------------------------------------------------------------------------
// Image processor worker factory
// ---------------------------------------------------------------------------

export interface ImageProcessorWorker {
  /** Resize an ImageBitmap and return it as a Blob. */
  resize(
    bitmap: ImageBitmap,
    width: number,
    height: number,
    type?: string,
    quality?: number,
  ): Promise<ImageWorkerResponse>

  /** Convert an ImageBitmap to a Blob without resizing. */
  toBlob(
    bitmap: ImageBitmap,
    type?: string,
    quality?: number,
  ): Promise<ImageWorkerResponse>

  /** Terminate the underlying Worker. Call when done to free resources. */
  terminate(): void
}

/**
 * Creates an image processor Web Worker.
 * Should be called once per component / operation and terminated afterwards.
 */
export function createImageProcessorWorker(): ImageProcessorWorker {
  const worker = new Worker(
    new URL('./imageProcessor.worker.ts', import.meta.url),
    { type: 'module' },
  )

  return {
    resize(bitmap, width, height, type, quality) {
      const msg: ImageWorkerMessage = { op: 'resize', bitmap, width, height, type, quality }
      return sendToWorker<ImageWorkerMessage, ImageWorkerResponse>(worker, msg, [bitmap])
    },

    toBlob(bitmap, type, quality) {
      const msg: ImageWorkerMessage = { op: 'toBlob', bitmap, type, quality }
      return sendToWorker<ImageWorkerMessage, ImageWorkerResponse>(worker, msg, [bitmap])
    },

    terminate() {
      worker.terminate()
    },
  }
}
