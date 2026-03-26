import { logger } from '@/config/logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  /** Name for logging */
  name: string;
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting to close the circuit (default: 30000) */
  resetTimeoutMs?: number;
  /** Number of successes in half-open state needed to close (default: 2) */
  successThreshold?: number;
  /** Optional fallback to execute when circuit is open */
  fallback?: <T>() => T | Promise<T>;
}

/**
 * Circuit breaker for external service calls.
 * Prevents cascading failures when downstream services (Firebase, Gemini, SMTP, Google Maps) are down.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail immediately (or use fallback)
 * - HALF_OPEN: Testing if service recovered, limited requests pass through
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly successThreshold: number;
  private readonly fallback?: <T>() => T | Promise<T>;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.successThreshold = options.successThreshold ?? 2;
    this.fallback = options.fallback;
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if enough time has passed to try again
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.info(`Circuit breaker [${this.name}] transitioning to HALF_OPEN`);
      } else {
        logger.warn(`Circuit breaker [${this.name}] is OPEN — rejecting request`, {
          failureCount: this.failureCount,
          retryInMs: this.resetTimeoutMs - (Date.now() - this.lastFailureTime),
        });

        if (this.fallback) {
          return this.fallback<T>();
        }
        throw new Error(`Circuit breaker [${this.name}] is open — service unavailable`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        logger.info(`Circuit breaker [${this.name}] CLOSED — service recovered`);
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  private onFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (this.state === 'HALF_OPEN') {
      // Failed during recovery test — go back to OPEN
      this.state = 'OPEN';
      this.successCount = 0;
      logger.error(`Circuit breaker [${this.name}] back to OPEN — recovery failed`, {
        error: errorMessage,
      });
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.error(`Circuit breaker [${this.name}] OPENED after ${this.failureCount} failures`, {
        error: errorMessage,
        resetTimeoutMs: this.resetTimeoutMs,
      });
    } else {
      logger.warn(
        `Circuit breaker [${this.name}] failure ${this.failureCount}/${this.failureThreshold}`,
        { error: errorMessage }
      );
    }
  }

  /** Get current circuit state for health checks */
  getState(): { name: string; state: CircuitState; failureCount: number } {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
    };
  }

  /** Force reset the circuit (for admin/manual recovery) */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    logger.info(`Circuit breaker [${this.name}] manually reset`);
  }
}

/**
 * Pre-configured circuit breakers for external services.
 * Import and use: `await circuitBreakers.gemini.execute(() => geminiCall())`
 */
export const circuitBreakers = {
  gemini: new CircuitBreaker({
    name: 'GeminiAI',
    failureThreshold: 3,
    resetTimeoutMs: 60000, // 1 minute — AI service may need time to recover
  }),
  firebase: new CircuitBreaker({
    name: 'Firebase-FCM',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  }),
  apns: new CircuitBreaker({
    name: 'Apple-APNS',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  }),
  email: new CircuitBreaker({
    name: 'SMTP-Email',
    failureThreshold: 3,
    resetTimeoutMs: 60000,
  }),
  geocoding: new CircuitBreaker({
    name: 'Google-Geocoding',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  }),
};
