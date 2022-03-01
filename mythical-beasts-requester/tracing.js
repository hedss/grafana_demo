// Include all OpenTelemetry dependencies for tracing
const api = require("@opentelemetry/api");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const { SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { W3CTraceContextPropagator } = require("@opentelemetry/core");
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

module.exports = () => {
  const options = {
    tags: [],
    host: process.env.TRACING_COLLECTOR_HOST,
    port: process.env.TRACING_COLLECTOR_PORT,
    maxPacketSize: 65000
  }

  // Create a tracer provider
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'mythical-requester',
    }),
  });

  // Export to Jaeger
  const exporter = new JaegerExporter(options);

  // Use simple span (should probably use Batch)
  const processor = new SimpleSpanProcessor(exporter);
  provider.addSpanProcessor(processor);
  provider.register();

  // Create a new header for propagation from a given span
  const propagator = new W3CTraceContextPropagator();
  const createPropagationHeader = (span) => {
    let carrier = {};
    // Inject the current trace context into the carrier object
    propagator.inject(
        api.trace.setSpanContext(api.ROOT_CONTEXT, span.spanContext()),
        carrier,
        api.defaultTextMapSetter
    );
    return carrier;
  };


  // Return instances of the API and the tracer to the calling app
  return {
    tracer: api.trace.getTracer("mythical-requester"),
    api: api,
    propagator: createPropagationHeader,
  }
};
