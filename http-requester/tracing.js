/* tracing.js */

// Require dependencies
//const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");
const api = require("@opentelemetry/api");
const { NodeTracerProvider } = require("@opentelemetry/node");
const { SimpleSpanProcessor, ConsoleSpanExporter } = require("@opentelemetry/tracing");
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');


module.exports = () => {
  const options = {
    tags: [], // optional
    // You can use the default UDPSender
    host: 'tempo', // optional
    port: 6832, // optional
    // OR you can use the HTTPSender as follows
    // endpoint: 'http://localhost:14268/api/traces',
    maxPacketSize: 65000 // optional
  }

  // Create a tracer provider
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'mythical-requester',
    }),
  });

  //console.log(api.context.active());

  // The exporter handles sending spans to your tracing backend
  //const exporter = new ConsoleSpanExporter();
  const exporter = new JaegerExporter(options);

  // The simple span processor sends spans to the exporter as soon as they are ended.
  const processor = new SimpleSpanProcessor(exporter);
  provider.addSpanProcessor(processor);

  // The provider must be registered in order to
  // be used by the OpenTelemetry API and instrumentations
  provider.register();

  // This will automatically enable all instrumentations
  registerInstrumentations({
    instrumentations: [getNodeAutoInstrumentations()],
  });

  return {
    tracer: api.trace.getTracer("test"),
    api: api
  }
};