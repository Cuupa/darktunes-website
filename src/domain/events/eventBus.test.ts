/**
 * src/domain/events/eventBus.test.ts
 *
 * Unit tests for the typed Event Bus.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEventBus } from './eventBus'
import type { ArtistSyncedEvent, AssetUploadedEvent } from './eventBus'

describe('EventBus', () => {
  let bus: ReturnType<typeof createEventBus>

  beforeEach(() => {
    bus = createEventBus()
  })

  // -------------------------------------------------------------------------
  // Basic subscribe / emit
  // -------------------------------------------------------------------------

  it('calls a handler when its event type is emitted', () => {
    const handler = vi.fn()
    bus.on('artist.synced', handler)

    bus.emit({ type: 'artist.synced', artistId: '1', name: 'Test' })

    expect(handler).toHaveBeenCalledOnce()
    const received = handler.mock.calls[0][0] as ArtistSyncedEvent
    expect(received.artistId).toBe('1')
    expect(received.name).toBe('Test')
  })

  it('does NOT call a handler registered for a different event type', () => {
    const artistHandler = vi.fn()
    const assetHandler = vi.fn()

    bus.on('artist.synced', artistHandler)
    bus.on('asset.uploaded', assetHandler)

    bus.emit({ type: 'artist.synced', artistId: '1', name: 'Test' })

    expect(artistHandler).toHaveBeenCalledOnce()
    expect(assetHandler).not.toHaveBeenCalled()
  })

  it('calls multiple handlers for the same event type', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()

    bus.on('artist.synced', h1)
    bus.on('artist.synced', h2)

    bus.emit({ type: 'artist.synced', artistId: '1', name: 'Test' })

    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // Unsubscribe
  // -------------------------------------------------------------------------

  it('stops calling a handler after unsubscribe', () => {
    const handler = vi.fn()
    const off = bus.on('artist.synced', handler)

    bus.emit({ type: 'artist.synced', artistId: '1', name: 'Test' })
    off()
    bus.emit({ type: 'artist.synced', artistId: '2', name: 'Test2' })

    expect(handler).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // Wildcard subscriber
  // -------------------------------------------------------------------------

  it('onAny receives every event type', () => {
    const handler = vi.fn()
    bus.onAny(handler)

    bus.emit({ type: 'artist.synced', artistId: '1', name: 'Test' })
    bus.emit({
      type: 'asset.uploaded',
      r2Key: 'uploads/x',
      publicUrl: 'https://cdn.example.com/x',
      mimeType: 'image/png',
      sizeBytes: 1024,
    })

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('onAny can be unsubscribed', () => {
    const handler = vi.fn()
    const off = bus.onAny(handler)

    bus.emit({ type: 'artist.synced', artistId: '1', name: 'Test' })
    off()
    bus.emit({ type: 'artist.synced', artistId: '2', name: 'Test2' })

    expect(handler).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // Timestamp auto-injection
  // -------------------------------------------------------------------------

  it('injects a timestamp when the event does not provide one', () => {
    const handler = vi.fn()
    bus.on('artist.synced', handler)

    bus.emit({ type: 'artist.synced', artistId: '1', name: 'Test' })

    const received = handler.mock.calls[0][0] as ArtistSyncedEvent
    expect(typeof received.timestamp).toBe('string')
    expect(received.timestamp).not.toBe('')
  })

  it('preserves a caller-supplied timestamp', () => {
    const handler = vi.fn()
    bus.on('asset.uploaded', handler)

    const ts = '2025-01-01T00:00:00.000Z'
    bus.emit({
      type: 'asset.uploaded',
      r2Key: 'uploads/x',
      publicUrl: 'https://cdn.example.com/x',
      mimeType: 'image/png',
      sizeBytes: 512,
      timestamp: ts,
    })

    const received = handler.mock.calls[0][0] as AssetUploadedEvent
    expect(received.timestamp).toBe(ts)
  })

  // -------------------------------------------------------------------------
  // clear()
  // -------------------------------------------------------------------------

  it('clear() removes all handlers', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()

    bus.on('artist.synced', h1)
    bus.onAny(h2)
    bus.clear()

    bus.emit({ type: 'artist.synced', artistId: '1', name: 'Test' })

    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Async handler errors are caught
  // -------------------------------------------------------------------------

  it('does not throw when an async handler rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    bus.on('artist.synced', async () => {
      throw new Error('handler error')
    })

    // Should not throw
    expect(() =>
      bus.emit({ type: 'artist.synced', artistId: '1', name: 'Test' }),
    ).not.toThrow()

    // Give the microtask queue a chance to flush
    await new Promise((r) => setTimeout(r, 0))

    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
