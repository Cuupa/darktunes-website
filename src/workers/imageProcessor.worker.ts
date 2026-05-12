/**
 * src/workers/imageProcessor.worker.ts
 *
 * Web Worker for CPU-intensive image processing tasks so the main thread
 * stays responsive while resizing, converting, or analysing images.
 *
 * Supported operations:
 *   - resize   — Downscale an ImageBitmap to target dimensions via OffscreenCanvas
 *   - toBlob   — Convert an ImageBitmap to a Blob in a given MIME type / quality
 *
 * Usage (from the main thread via src/workers/index.ts):
 *   const worker = createImageProcessorWorker()
 *   const blob = await worker.toBlob(bitmap, 'image/webp', 0.85)
 *   worker.terminate()
 *
 * All message payloads are typed via ImageWorkerMessage / ImageWorkerResponse.
 * Transferable objects (ImageBitmap) are transferred to avoid copying.
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export type ImageWorkerOperation = 'resize' | 'toBlob'

export interface ResizePayload {
  op: 'resize'
  bitmap: ImageBitmap
  width: number
  height: number
  type?: string  // MIME type, default 'image/webp'
  quality?: number
}

export interface ToBlobPayload {
  op: 'toBlob'
  bitmap: ImageBitmap
  type?: string
  quality?: number
}

export type ImageWorkerMessage = ResizePayload | ToBlobPayload

export interface ImageWorkerSuccess {
  ok: true
  blob: Blob
  width: number
  height: number
}

export interface ImageWorkerError {
  ok: false
  error: string
}

export type ImageWorkerResponse = ImageWorkerSuccess | ImageWorkerError

// ---------------------------------------------------------------------------
// Worker handler
// ---------------------------------------------------------------------------

self.onmessage = async (event: MessageEvent<ImageWorkerMessage>) => {
  const msg = event.data

  try {
    let canvas: OffscreenCanvas
    let ctx: OffscreenCanvasRenderingContext2D

    if (msg.op === 'resize') {
      canvas = new OffscreenCanvas(msg.width, msg.height)
      ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
      ctx.drawImage(msg.bitmap, 0, 0, msg.width, msg.height)
      msg.bitmap.close()
    } else {
      // toBlob — preserve original dimensions
      canvas = new OffscreenCanvas(msg.bitmap.width, msg.bitmap.height)
      ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
      ctx.drawImage(msg.bitmap, 0, 0)
      msg.bitmap.close()
    }

    const blob = await canvas.convertToBlob({
      type: msg.type ?? 'image/webp',
      quality: msg.quality ?? 0.85,
    })

    const response: ImageWorkerSuccess = {
      ok: true,
      blob,
      width: canvas.width,
      height: canvas.height,
    }

    self.postMessage(response)
  } catch (err) {
    const response: ImageWorkerError = {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown worker error',
    }
    self.postMessage(response)
  }
}
