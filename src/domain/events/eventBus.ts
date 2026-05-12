/**
 * src/domain/events/eventBus.ts
 *
 * Typed, in-process publish/subscribe Event Bus for domain events.
 *
 * Why an Event Bus?
 *   The UI currently wires state updates through props and callbacks.  An
 *   Event Bus allows decoupled communication between features: for example,
 *   the sync pipeline can publish a `SyncCompleted` event and the Assets
 *   panel can subscribe to refresh its list — without the two components
 *   knowing about each other.
 *
 * Design decisions:
 *   • Synchronous dispatch — handlers are called in the order they were
 *     registered.  Async handlers receive the event and run independently
 *     (fire-and-forget); errors are caught and logged.
 *   • Wildcard subscriber (`*`) receives every event.
 *   • Typed events via DomainEvent discriminated union.
 *   • A singleton `eventBus` is exported for application-wide use.
 *     Modules can also create isolated buses via `createEventBus()` for
 *     testing.
 *
 * Usage:
 *   import { eventBus } from '@/domain/events/eventBus'
 *
 *   // Subscribe
 *   const off = eventBus.on('artist.synced', (e) => console.log(e.artistId))
 *
 *   // Publish
 *   eventBus.emit({ type: 'artist.synced', artistId: '123', name: 'Neuroklast' })
 *
 *   // Unsubscribe
 *   off()
 */

// ---------------------------------------------------------------------------
// Domain event definitions
// ---------------------------------------------------------------------------

/** Base interface every domain event must extend. */
export interface BaseDomainEvent {
  readonly type: string
  /** ISO timestamp; set automatically by `emit` if omitted. */
  readonly timestamp?: string
}

export interface ArtistSyncedEvent extends BaseDomainEvent {
  readonly type: 'artist.synced'
  readonly artistId: string
  readonly name: string
}

export interface ReleaseSyncedEvent extends BaseDomainEvent {
  readonly type: 'release.synced'
  readonly releaseId: string
  readonly title: string
  readonly artistId: string
}

export interface AssetUploadedEvent extends BaseDomainEvent {
  readonly type: 'asset.uploaded'
  readonly r2Key: string
  readonly publicUrl: string
  readonly mimeType: string
  readonly sizeBytes: number
}

export interface AssetDeletedEvent extends BaseDomainEvent {
  readonly type: 'asset.deleted'
  readonly assetId: string
}

export interface UserRoleChangedEvent extends BaseDomainEvent {
  readonly type: 'user.role.changed'
  readonly userId: string
  readonly oldRole: string
  readonly newRole: string
}

export interface SyncCompletedEvent extends BaseDomainEvent {
  readonly type: 'sync.completed'
  readonly totalSynced: number
  readonly errors: string[]
}

/** All known domain events — extend this union when adding new event types. */
export type DomainEvent =
  | ArtistSyncedEvent
  | ReleaseSyncedEvent
  | AssetUploadedEvent
  | AssetDeletedEvent
  | UserRoleChangedEvent
  | SyncCompletedEvent

/** Map from event type string to its concrete event shape. */
export type DomainEventMap = {
  [E in DomainEvent as E['type']]: E
}

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

export type EventHandler<E extends DomainEvent = DomainEvent> = (event: E) => void | Promise<void>

// ---------------------------------------------------------------------------
// Event Bus implementation
// ---------------------------------------------------------------------------

export interface IEventBus {
  /**
   * Subscribe to a specific event type.
   * @returns An unsubscribe function.
   */
  on<K extends keyof DomainEventMap>(
    type: K,
    handler: EventHandler<DomainEventMap[K]>,
  ): () => void

  /**
   * Subscribe to ALL events (wildcard).
   * @returns An unsubscribe function.
   */
  onAny(handler: EventHandler<DomainEvent>): () => void

  /** Emit a domain event to all matching subscribers. */
  emit<E extends DomainEvent>(event: E): void

  /** Remove all handlers (useful for test teardown). */
  clear(): void
}

function createEventBus(): IEventBus {
  const handlers = new Map<string, Set<EventHandler>>()
  const wildcardHandlers = new Set<EventHandler>()

  function getOrCreate(type: string): Set<EventHandler> {
    if (!handlers.has(type)) handlers.set(type, new Set())
    return handlers.get(type)!
  }

  return {
    on(type, handler) {
      const set = getOrCreate(type as string)
      set.add(handler as EventHandler)
      return () => set.delete(handler as EventHandler)
    },

    onAny(handler) {
      wildcardHandlers.add(handler)
      return () => wildcardHandlers.delete(handler)
    },

    emit(event) {
      const stamped = { ...event, timestamp: event.timestamp ?? new Date().toISOString() }

      const typed = handlers.get(stamped.type)
      if (typed) {
        for (const handler of typed) {
          const result = handler(stamped)
          if (result instanceof Promise) {
            result.catch((err) =>
              console.error(`[EventBus] Async handler error for "${stamped.type}":`, err),
            )
          }
        }
      }

      for (const handler of wildcardHandlers) {
        const result = handler(stamped)
        if (result instanceof Promise) {
          result.catch((err) =>
            console.error(`[EventBus] Async wildcard handler error for "${stamped.type}":`, err),
          )
        }
      }
    },

    clear() {
      handlers.clear()
      wildcardHandlers.clear()
    },
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { createEventBus }

/**
 * Application-wide singleton event bus.
 * Import this in features that need to publish or subscribe to domain events.
 */
export const eventBus: IEventBus = createEventBus()
