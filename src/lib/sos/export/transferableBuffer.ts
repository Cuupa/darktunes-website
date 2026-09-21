/**
 * ExcelJS `writeBuffer()` returns a Node `Buffer` / `Uint8Array` in the
 * worker. Those are not Transferable; `postMessage(..., [view])` throws
 * "Value at index 0 does not have a transferable type."
 */
export function toTransferableArrayBuffer(data: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  const view = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const copy = new ArrayBuffer(view.byteLength)
  new Uint8Array(copy).set(view)
  return copy
}
