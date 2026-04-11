// Phase F1 follow-up — OpenTelemetry bootstrap for the web frontend.
//
// This file must be imported at the VERY top of src/main.tsx before
// any other src/* import so the fetch/XHR instrumentations can patch
// the global functions before React or axios touch them. The
// instrumentation is env-gated — a build without VITE_OTEL_ENABLED
// set to 'true' pays zero runtime cost because the SDK is never
// started.
//
// Configuration (Vite env, prefixed with VITE_ so Vite injects them
// into the browser bundle):
//
//   VITE_OTEL_ENABLED             'true' to turn tracing on; anything
//                                 else is off. Default: off.
//   VITE_OTEL_SERVICE_NAME        Service name attribute. Default:
//                                 'crm-frontend'.
//   VITE_OTEL_EXPORTER_OTLP_URL   OTLP HTTP endpoint for traces.
//                                 Default: '/v1/traces' (same-origin,
//                                 assuming the Nginx reverse proxy
//                                 forwards to the collector).
//
// W3C traceparent continuity: the fetch + XHR instrumentations
// automatically inject the `traceparent` header on outgoing requests
// so the backend (Phase F1 commit 828780ef) stitches its server span
// into the same trace. No manual propagator wiring is required.

import { trace, context } from '@opentelemetry/api';
import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const enabled = viteEnv.VITE_OTEL_ENABLED === 'true';

let provider: WebTracerProvider | null = null;

if (enabled && typeof window !== 'undefined') {
  const serviceName = viteEnv.VITE_OTEL_SERVICE_NAME ?? 'crm-frontend';
  const serviceVersion = viteEnv.VITE_APP_VERSION ?? '1.0.0';
  const exporterUrl = viteEnv.VITE_OTEL_EXPORTER_OTLP_URL ?? '/v1/traces';

  try {
    provider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
        'deployment.environment': viteEnv.MODE ?? 'development',
      }),
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: exporterUrl }))],
    });

    provider.register({
      // ZoneContextManager is required so span context survives
      // across async boundaries (React event handlers, promise
      // chains, setTimeout). Without it every span becomes
      // orphaned the moment an async function awaits.
      contextManager: new ZoneContextManager(),
    });

    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          // Propagate traceparent to every same-origin API call.
          // The regex matches both relative `/api/...` and the
          // absolute production URL so the pattern works in dev
          // (Vite proxy) and prod (Nginx) without re-config.
          propagateTraceHeaderCorsUrls: [/\/api\//, /crm\.allcheckservices\.com/],
        }),
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: [/\/api\//, /crm\.allcheckservices\.com/],
        }),
      ],
    });

    // eslint-disable-next-line no-console
    console.info(
      `[otel] web tracing enabled — service=${serviceName} version=${serviceVersion} url=${exporterUrl}`
    );
  } catch (error) {
    console.error('[otel] failed to start web tracing', error);
    provider = null;
  }
}

/** Exposed so app code can create manual spans if it wants. */
export const getTracer = (name = 'crm-frontend') => trace.getTracer(name);

/** Exposed for testability / manual propagation. */
export const otelContext = context;

/** Flush buffered spans before a hard page unload. */
export async function flushTracing(): Promise<void> {
  if (!provider) {
    return;
  }
  try {
    await provider.forceFlush();
  } catch {
    /* non-fatal */
  }
}

export const isTracingEnabled = (): boolean => enabled;
