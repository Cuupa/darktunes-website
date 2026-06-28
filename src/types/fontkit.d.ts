declare module 'fontkit' {
  import type { Font } from 'pdf-lib'

  export function create(buffer: Uint8Array, postscriptName?: string): Font
}