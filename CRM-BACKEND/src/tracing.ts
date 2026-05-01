// OpenTelemetry tracing bootstrap — Phase F1.
//
// Must be imported at the very top of the process entrypoint BEFORE
// any other `src/*` import. That's because OTel's auto-
// instrumentations patch modules at require-time; requiring express
// or pg before the SDK is started leaves those modules uninstrumented.
//
// Wired via `import './tracing'` at the top of src/index.ts.
//
// Configuration:
//   - OTEL_ENABLED        (default: 'false' — opt-in at boot)
//   - OTEL_SERVICE_NAME   (default: 'crm-backend')
//   - OTEL_EXPORTER_OTLP_ENDPOINT
//                         (default: http://localhost:4318 —
//                          standard OTLP HTTP endpoint)
//
// The SDK is deliberately opt-in so local development doesn't need
// a collector running. Flip OTEL_ENABLED=true in staging / prod
// env to enable. A graceful shutdown hook is registered so buffered
// spans flush on SIGTERM.

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

const enabled = process.env.OTEL_ENABLED === 'true';

let sdk: InstanceType<typeof NodeSDK> | null = null;

if (enabled) {
  // Route OTel internal diagnostics to the console at WARN by
  // default — full DEBUG is too chatty for steady-state operation.
  diag.setLogger(
    new DiagConsoleLogger(),
    process.env.OTEL_LOG_LEVEL === 'debug' ? DiagLogLevel.DEBUG : DiagLogLevel.WARN
  );

  const serviceName = process.env.OTEL_SERVICE_NAME || 'crm-backend';
  const serviceVersion = process.env.npm_package_version || '1.0.0';
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

  // 2026-05-01 pre-AWS hardening: head-based ratio sampling. Default
  // 1.0 (sample everything) so dev keeps full fidelity. Production
  // should set OTEL_TRACE_SAMPLING_RATIO=0.1 (or lower) to keep
  // CloudWatch / ADOT cost bounded — without sampling, 100K cases/day
  // × ~20 spans/case = 2M spans/day, which explodes ingest costs.
  const samplingRatioRaw = process.env.OTEL_TRACE_SAMPLING_RATIO;
  const samplingRatio = (() => {
    const parsed = samplingRatioRaw != null ? Number(samplingRatioRaw) : 1;
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 1;
    }
    if (parsed > 1) {
      return 1;
    }
    return parsed;
  })();

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
    sampler: new TraceIdRatioBasedSampler(samplingRatio),
    traceExporter: new OTLPTraceExporter({ url: otlpEndpoint }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Quiet down a couple of instrumentations that produce huge
        // span volume without much debugging value.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
    // This file is pre-logger bootstrap so we can't use the
    // winston logger here. Use console.info (allowed by the
    // project's lint config).
    console.info(
      `[otel] tracing enabled — service=${serviceName} version=${serviceVersion} endpoint=${otlpEndpoint} sampling=${samplingRatio}`
    );
  } catch (error) {
    console.error('[otel] failed to start tracing', error);
    sdk = null;
  }

  // Flush buffered spans on graceful shutdown. The main index.ts
  // shutdown path also calls shutdownTracing() explicitly, but this
  // hook covers hard exits.
  const onShutdown = (): void => {
    void shutdownTracing();
  };
  process.once('SIGTERM', onShutdown);
  process.once('SIGINT', onShutdown);
}

/**
 * Flush any buffered OTel spans and shut the SDK down. Safe to
 * call multiple times — the second call is a no-op.
 */
export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }
  const current = sdk;
  sdk = null;
  try {
    await current.shutdown();
  } catch (error) {
    console.warn('[otel] shutdown failed', error);
  }
}

export const isTracingEnabled = (): boolean => enabled;
