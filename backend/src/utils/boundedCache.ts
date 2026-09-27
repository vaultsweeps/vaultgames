/**
 * A small in-memory cache with a hard size cap (LRU eviction) and a TTL, for caches keyed by values that can
 * come from a request (a game id, a slug, ...) rather than from a small, fixed, admin-controlled set. A plain
 * `Map` used as a cache in that situation never shrinks — every distinct key an attacker sends becomes a
 * permanent entry — so this exists anywhere that pattern shows up.
 */

interface Entry<V> {
  value: V
  expiresAt: number
}

export class BoundedCache<V> {
  private map = new Map<string, Entry<V>>()
  private pending = new Map<string, Promise<V>>()

  /**
   * @param maxSize   hard cap on the number of entries; the least-recently-used one is evicted first
   * @param ttlMs     how long a normal (hit) entry stays fresh
   * @param missTtlMs how long a "negative" entry (see `isMiss` in getOrCompute) stays fresh — kept short so a
   *                  stream of invalid/nonexistent keys can't occupy cache slots for as long as a real one,
   *                  and a value that starts existing shortly after being looked up is picked up quickly
   * @param maxKeyLength keys longer than this are truncated before use, so an attacker sending an oversized
   *                  key cannot make a single entry larger than intended (the entry count is already capped
   *                  by maxSize; this caps the size of each entry's key too)
   */
  constructor(
    private maxSize: number,
    private ttlMs: number,
    private missTtlMs: number = ttlMs,
    private maxKeyLength: number = 128
  ) {}

  private normalizeKey(key: string): string {
    return key.length > this.maxKeyLength ? key.slice(0, this.maxKeyLength) : key
  }

  private evictIfNeeded() {
    // Map preserves insertion order, and get()/set() below always re-insert on touch, so the first key
    // returned by the iterator is always the least-recently-used one.
    while (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value
      if (oldestKey === undefined) break
      this.map.delete(oldestKey)
    }
  }

  get(rawKey: string): V | undefined {
    const key = this.normalizeKey(rawKey)
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key)
      return undefined
    }
    // Touch: move to the most-recently-used end so eviction never removes something still being read.
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(rawKey: string, value: V, isMiss = false): void {
    const key = this.normalizeKey(rawKey)
    this.map.delete(key)
    this.map.set(key, { value, expiresAt: Date.now() + (isMiss ? this.missTtlMs : this.ttlMs) })
    this.evictIfNeeded()
  }

  /**
   * Cache-aside with concurrent-miss de-duplication: if several requests ask for the same (cold) key at the
   * same time, `compute` runs once and every caller gets the same result, instead of each one racing to hit
   * the database and construct its own copy of whatever `compute` returns.
   */
  async getOrCompute(rawKey: string, compute: () => Promise<V>, isMiss: (v: V) => boolean = () => false): Promise<V> {
    const key = this.normalizeKey(rawKey)
    const cached = this.get(key)
    if (cached !== undefined) return cached

    const inFlight = this.pending.get(key)
    if (inFlight) return inFlight

    const promise = compute()
      .then(value => {
        this.set(key, value, isMiss(value))
        this.pending.delete(key)
        return value
      })
      .catch(err => {
        this.pending.delete(key)
        throw err
      })
    this.pending.set(key, promise)
    return promise
  }

  get size(): number {
    return this.map.size
  }
}
