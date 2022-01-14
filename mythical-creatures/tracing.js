// Include all OpenTelemetry dependencies for tracing
const api = require("@opentelemetry/api");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const { SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

module.exports = () => {
  const options = {
    tags: [],
    host: 'agent',
    port: 6832,
    maxPacketSize: 65000
  }

  // Create a tracer provider
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'mythical-creatures',
    }),
  });

  // Export to Jaeger
  const exporter = new JaegerExporter(options);

  // Use simple span (should probably use Batch)
  const processor = new SimpleSpanProcessor(exporter);
  provider.addSpanProcessor(processor);
  provider.register();

  // Enable everything that's available
  registerInstrumentations({
    instrumentations: [getNodeAutoInstrumentations()],
  });

  // Return instances of the API and the tracer to the calling app
  return {
    tracer: api.trace.getTracer("test"),
    api: api
  }
};
