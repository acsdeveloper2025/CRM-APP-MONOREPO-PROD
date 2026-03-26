import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from './circuitBreaker';

// Mock logger
vi.mock('@/config/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 3,
      resetTimeoutMs: 100, // Short for tests
      successThreshold: 2,
    });
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState().state).toBe('CLOSED');
    expect(breaker.getState().failureCount).toBe(0);
  });

  it('passes through successful calls in CLOSED state', async () => {
    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(breaker.getState().state).toBe('CLOSED');
  });

  it('tracks failures but stays CLOSED below threshold', async () => {
    const failing = () => Promise.reject(new Error('fail'));

    await expect(breaker.execute(failing)).rejects.toThrow('fail');
    expect(breaker.getState().state).toBe('CLOSED');
    expect(breaker.getState().failureCount).toBe(1);

    await expect(breaker.execute(failing)).rejects.toThrow('fail');
    expect(breaker.getState().state).toBe('CLOSED');
    expect(breaker.getState().failureCount).toBe(2);
  });

  it('opens after reaching failure threshold', async () => {
    const failing = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failing)).rejects.toThrow('fail');
    }

    expect(breaker.getState().state).toBe('OPEN');
  });

  it('rejects immediately when OPEN', async () => {
    const failing = () => Promise.reject(new Error('fail'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failing)).rejects.toThrow('fail');
    }

    // Should reject without calling the function
    const fn = vi.fn().mockResolvedValue('should not be called');
    await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker [test-service] is open');
    expect(fn).not.toHaveBeenCalled();
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    const failing = () => Promise.reject(new Error('fail'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failing)).rejects.toThrow('fail');
    }
    expect(breaker.getState().state).toBe('OPEN');

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 150));

    // Next call should go through (HALF_OPEN)
    const result = await breaker.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
  });

  it('closes after enough successes in HALF_OPEN', async () => {
    const failing = () => Promise.reject(new Error('fail'));

    // Open → wait → HALF_OPEN
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failing)).rejects.toThrow('fail');
    }
    await new Promise(r => setTimeout(r, 150));

    // Two successes needed to close
    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.getState().state).toBe('HALF_OPEN');

    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.getState().state).toBe('CLOSED');
    expect(breaker.getState().failureCount).toBe(0);
  });

  it('goes back to OPEN if a call fails in HALF_OPEN', async () => {
    const failing = () => Promise.reject(new Error('fail'));

    // Open → wait → HALF_OPEN
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failing)).rejects.toThrow('fail');
    }
    await new Promise(r => setTimeout(r, 150));

    // Fail during HALF_OPEN
    await expect(breaker.execute(failing)).rejects.toThrow('fail');
    expect(breaker.getState().state).toBe('OPEN');
  });

  it('resets failure count on success in CLOSED state', async () => {
    const failing = () => Promise.reject(new Error('fail'));

    // 2 failures (below threshold of 3)
    await expect(breaker.execute(failing)).rejects.toThrow();
    await expect(breaker.execute(failing)).rejects.toThrow();
    expect(breaker.getState().failureCount).toBe(2);

    // 1 success resets the count
    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.getState().failureCount).toBe(0);
  });

  it('uses fallback when OPEN and fallback is provided', async () => {
    const breakerWithFallback = new CircuitBreaker({
      name: 'fallback-test',
      failureThreshold: 1,
      resetTimeoutMs: 5000,
      fallback: () => 'fallback-value',
    });

    // Open the circuit
    await expect(
      breakerWithFallback.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();

    // Should use fallback
    const result = await breakerWithFallback.execute(() => Promise.resolve('ignored'));
    expect(result).toBe('fallback-value');
  });

  it('manual reset restores CLOSED state', async () => {
    const failing = () => Promise.reject(new Error('fail'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failing)).rejects.toThrow();
    }
    expect(breaker.getState().state).toBe('OPEN');

    breaker.reset();
    expect(breaker.getState().state).toBe('CLOSED');
    expect(breaker.getState().failureCount).toBe(0);
  });
});
