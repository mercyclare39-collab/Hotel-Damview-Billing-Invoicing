/**
 * ENTERPRISE API RATE LIMITER, ADAPTIVE THROTTLER & CIRCUIT BREAKER
 * Hotel Damview ERP (Kenya)
 *
 * Provides production-grade protection against:
 * 1. Google Apps Script execution time limits & concurrent lock contention (LockService)
 * 2. HTTP 429 Too Many Requests & daily quota exhaustion ("Service invoked too many times")
 * 3. Rapid redundant polling bursts from multi-tab focus, online reconnects, and component mounts
 * 4. Request coalescing (deduplication of in-flight identical network calls)
 * 5. Intelligent read caching with sliding TTL and cache invalidation on mutations
 */

export interface RateLimiterTelemetry {
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  availableTokens: number;
  maxTokens: number;
  consecutiveFailures: number;
  isThrottled: boolean;
  cooldownRemainingMs: number;
  lastTripReason: string | null;
  totalRequestsHandled: number;
  totalRequestsThrottled: number;
  totalCoalesced: number;
  cacheHitCount: number;
}

type RateLimitTelemetryListener = (telemetry: RateLimiterTelemetry) => void;

interface QueuedTask<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  priority: number; // Higher numbers execute first
  timestamp: number;
  coalesceKey?: string;
}

export class EnterpriseApiRateLimiter {
  // Token Bucket Configuration (12 tokens max, 1 token replenished every 400ms)
  private maxTokens = 12;
  private tokens = 12;
  private refillRateMs = 450; // Refill 1 token every 450ms (~2.2 req/sec sustained)
  private minInterCallDelayMs = 250; // Minimum gap between dispatched requests
  private lastDispatchTime = 0;
  private refillTimer: any = null;

  // Circuit Breaker State
  private circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private consecutiveFailures = 0;
  private failureThreshold = 3;
  private circuitTripTimestamp = 0;
  private circuitCooldownMs = 6000; // Base cooldown (expands exponentially on repeated trips)
  private lastTripReason: string | null = null;

  // Queue & In-flight Task Management
  private taskQueue: QueuedTask<any>[] = [];
  private isProcessingQueue = false;
  private inFlightPromises = new Map<string, Promise<any>>();
  private readCache = new Map<string, { data: any; expiresAt: number }>();

  // Telemetry & Listeners
  private listeners = new Set<RateLimitTelemetryListener>();
  private totalRequestsHandled = 0;
  private totalRequestsThrottled = 0;
  private totalCoalesced = 0;
  private cacheHitCount = 0;

  constructor() {
    this.startTokenRefillLoop();
  }

  private startTokenRefillLoop() {
    if (typeof window === 'undefined') return;
    if (this.refillTimer) clearInterval(this.refillTimer);

    this.refillTimer = setInterval(() => {
      if (this.tokens < this.maxTokens) {
        this.tokens = Math.min(this.maxTokens, this.tokens + 1);
        this.processQueue();
      }

      // Check if circuit breaker can transition from OPEN to HALF_OPEN
      if (this.circuitState === 'OPEN') {
        const elapsed = Date.now() - this.circuitTripTimestamp;
        if (elapsed >= this.circuitCooldownMs) {
          this.circuitState = 'HALF_OPEN';
          this.emitTelemetry();
          this.processQueue();
        }
      }
    }, this.refillRateMs);
  }

  /**
   * Generates a stable fingerprint key for deduplicating identical network calls
   */
  public generateKey(url: string, payload: any): string {
    const action = payload?.action || payload?.type || 'UNKNOWN';
    let docId = payload?.documentId || payload?.document?.documentNumber || payload?.docType || '';
    let payId = payload?.paymentId || payload?.payment?.receiptNumber || '';
    let cliId = payload?.clientId || payload?.client?.id || '';
    return `${url}::${action}::${docId}::${payId}::${cliId}::${JSON.stringify(payload).length}`;
  }

  /**
   * Executes a network call through the Rate Limiter, Circuit Breaker, Deduplicator, and Cache
   */
  public async execute<T>(
    url: string,
    payload: any,
    fn: () => Promise<T>,
    options?: {
      priority?: number; // Higher executes first (e.g. user-initiated action = 10, background = 1)
      cacheTtlMs?: number; // TTL for cacheable queries like GET_SHEET_DATA
      bypassCache?: boolean;
      timeoutMs?: number;
    }
  ): Promise<T> {
    const action = String(payload?.action || payload?.type || '').toUpperCase();
    const isReadOnly =
      action === 'GET_SHEET_DATA' ||
      action === 'PULL_ALL_DATA' ||
      action === 'GET_NEXT_DOCUMENT_NUMBER' ||
      action === 'PING' ||
      action === 'HEALTHCHECK';

    const coalesceKey = this.generateKey(url, payload);

    // 1. Check Read-Only In-Memory Cache
    if (isReadOnly && !options?.bypassCache && options?.cacheTtlMs && options.cacheTtlMs > 0) {
      const cached = this.readCache.get(coalesceKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.cacheHitCount++;
        this.emitTelemetry();
        return cached.data as T;
      }
    }

    // 2. Coalesce In-Flight Duplicate Calls
    if (this.inFlightPromises.has(coalesceKey)) {
      this.totalCoalesced++;
      this.emitTelemetry();
      return this.inFlightPromises.get(coalesceKey) as Promise<T>;
    }

    // 3. Invalidate Read Cache on Mutation Actions
    if (!isReadOnly) {
      this.invalidateReadCache();
    }

    // 4. Enqueue Call into Managed Rate Limiting Queue
    const priority = options?.priority ?? (isReadOnly ? 2 : 5);

    const promise = new Promise<T>((resolve, reject) => {
      this.taskQueue.push({
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fn: async () => {
          try {
            const result = await fn();
            // Cache successful read results
            if (isReadOnly && options?.cacheTtlMs && options.cacheTtlMs > 0) {
              this.readCache.set(coalesceKey, {
                data: result,
                expiresAt: Date.now() + options.cacheTtlMs,
              });
            }
            return result;
          } catch (err: any) {
            throw err;
          }
        },
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
        coalesceKey,
      });

      // Sort queue by priority descending, then timestamp ascending
      this.taskQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
      this.processQueue();
    });

    this.inFlightPromises.set(coalesceKey, promise);

    try {
      const res = await promise;
      return res;
    } finally {
      this.inFlightPromises.delete(coalesceKey);
    }
  }

  /**
   * Internal queue processor respecting tokens, spacing delays, and circuit status
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.taskQueue.length === 0) return;

    if (this.circuitState === 'OPEN') {
      this.totalRequestsThrottled++;
      this.emitTelemetry();
      return;
    }

    if (this.tokens <= 0) {
      this.totalRequestsThrottled++;
      this.emitTelemetry();
      return;
    }

    const now = Date.now();
    const timeSinceLast = now - this.lastDispatchTime;
    if (timeSinceLast < this.minInterCallDelayMs) {
      const wait = this.minInterCallDelayMs - timeSinceLast;
      setTimeout(() => this.processQueue(), wait);
      return;
    }

    this.isProcessingQueue = true;
    const task = this.taskQueue.shift();
    if (!task) {
      this.isProcessingQueue = false;
      return;
    }

    this.tokens = Math.max(0, this.tokens - 1);
    this.lastDispatchTime = Date.now();
    this.totalRequestsHandled++;
    this.emitTelemetry();

    try {
      const result = await task.fn();
      this.handleTaskSuccess();
      task.resolve(result);
    } catch (err: any) {
      this.handleTaskFailure(err);
      task.reject(err);
    } finally {
      this.isProcessingQueue = false;
      if (this.taskQueue.length > 0) {
        setTimeout(() => this.processQueue(), this.minInterCallDelayMs);
      }
    }
  }

  /**
   * Handles successful call, resetting circuit breaker and failure counters
   */
  private handleTaskSuccess() {
    this.consecutiveFailures = 0;
    if (this.circuitState === 'HALF_OPEN') {
      this.circuitState = 'CLOSED';
      this.circuitCooldownMs = 6000;
      this.lastTripReason = null;
    }
    this.emitTelemetry();
  }

  /**
   * Inspects errors to detect Google Apps Script rate limits, concurrent locks, and quota exhaustion
   */
  private handleTaskFailure(err: any) {
    const errorMsg = (err?.message || String(err || '')).toLowerCase();
    this.consecutiveFailures++;

    const isRateLimit =
      errorMsg.includes('429') ||
      errorMsg.includes('too many requests') ||
      errorMsg.includes('service invoked too many times') ||
      errorMsg.includes('rate limit exceeded') ||
      errorMsg.includes('user rate limit') ||
      errorMsg.includes('quota exceeded');

    const isLockBusy =
      errorMsg.includes('system busy') ||
      errorMsg.includes('lock timeout') ||
      errorMsg.includes('busy processing') ||
      errorMsg.includes('another process was using');

    const isTimeout =
      errorMsg.includes('exceeded maximum execution time') ||
      errorMsg.includes('timed out') ||
      errorMsg.includes('aborterror');

    if (isRateLimit || isLockBusy || this.consecutiveFailures >= this.failureThreshold) {
      this.tripCircuitBreaker(
        isRateLimit
          ? 'Quota Rate Limit Throttled (HTTP 429 / Quota Limit)'
          : isLockBusy
          ? 'Spreadsheet Lock Contention (Transient System Busy)'
          : isTimeout
          ? 'Execution Timeout Protection'
          : `Consecutive Network Errors (${this.consecutiveFailures})`
      );
    } else {
      this.emitTelemetry();
    }
  }

  /**
   * Trips the circuit breaker to prevent hammering overloaded backend
   */
  private tripCircuitBreaker(reason: string) {
    this.circuitState = 'OPEN';
    this.circuitTripTimestamp = Date.now();
    this.lastTripReason = reason;

    // Exponential backoff with randomized jitter (e.g. 6s -> 12s -> 24s + jitter up to 60s max)
    const jitter = Math.floor(Math.random() * 2000);
    this.circuitCooldownMs = Math.min(60000, this.circuitCooldownMs * 1.5 + jitter);

    console.warn(`[EnterpriseRateLimiter] Circuit Breaker TRIPPED: ${reason}. Cooldown: ${Math.round(this.circuitCooldownMs / 1000)}s`);
    this.emitTelemetry();
  }

  /**
   * Manually resets rate limiter state and drains queue
   */
  public resetCircuit() {
    this.circuitState = 'CLOSED';
    this.tokens = this.maxTokens;
    this.consecutiveFailures = 0;
    this.circuitCooldownMs = 6000;
    this.lastTripReason = null;
    this.emitTelemetry();
    this.processQueue();
  }

  /**
   * Clears in-memory read cache on mutations
   */
  public invalidateReadCache() {
    this.readCache.clear();
  }

  /**
   * Returns current telemetry metrics
   */
  public getTelemetry(): RateLimiterTelemetry {
    const elapsed = Date.now() - this.circuitTripTimestamp;
    const cooldownRemainingMs =
      this.circuitState === 'OPEN' ? Math.max(0, this.circuitCooldownMs - elapsed) : 0;

    return {
      circuitState: this.circuitState,
      availableTokens: this.tokens,
      maxTokens: this.maxTokens,
      consecutiveFailures: this.consecutiveFailures,
      isThrottled: this.circuitState === 'OPEN' || this.tokens === 0,
      cooldownRemainingMs,
      lastTripReason: this.lastTripReason,
      totalRequestsHandled: this.totalRequestsHandled,
      totalRequestsThrottled: this.totalRequestsThrottled,
      totalCoalesced: this.totalCoalesced,
      cacheHitCount: this.cacheHitCount,
    };
  }

  public subscribe(listener: RateLimitTelemetryListener): () => void {
    this.listeners.add(listener);
    listener(this.getTelemetry());
    return () => this.listeners.delete(listener);
  }

  private emitTelemetry() {
    const tel = this.getTelemetry();
    this.listeners.forEach((l) => {
      try {
        l(tel);
      } catch (e) {
        console.error('[RateLimiter] Listener error:', e);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('damview:rate-limiter-telemetry', { detail: tel })
      );
    }
  }
}

export const apiRateLimiter = new EnterpriseApiRateLimiter();
