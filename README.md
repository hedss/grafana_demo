# grafana_demo

This is built on top of a demo I gave as part of my interview at Grafana Labs.

It's been added to a bit, very roughly, acting as a small sandbox for various features.

## OpenTelemetry

All the interesting stuff here is in `mythical-creatures/index.js` and `http-requester/index.js`.

Each registers with Otel in the very first request by invoking `tracing.js` (note, should just self-invoke this), which would usually be code in an NPM library used by all your JS services). Every subsequently requested module is then checked against the provided Otel autoinstrumentations and if there is a tracing pattern for it, it's bound to the relevant code.

This, for example, means that when Express receives a request, tracing is automatically invoked with spans being added as appropriate. Further calls from the endpoint method also get included in the trace as child/sibling spans. In the `mythical-creatures` service, there is *no* manual instrumentation, it all takes place via autoinstrumentation, although each endpoint does grab the context purely to output the trace ID to logs.

In the case of code where it's not called by an autoinstrumented service, a trace can be started manually with a new span, but then Otel takes over for any further downstream calls that include autoinstrumentations for them. In the case of the `http-requester`, we start with a single span when it requests an endpoint from the creatures service, but Otel automatically injects all the span information (and tags) into the headers of the requests, so when the creatures server receives a request, Otel unpacks the span/tag information from the header of the request, then continues to use the parent span and trace rather than create a new one. All further autoinstrumentation occurs as normal.

The demo also outputs some metrics, both in the form of a counter and bucket (`requests` and `request_times`). General histogram rules occur for the bucket.

Logs are output via Loki, by HTTP rather than stdout. This needs fixing now the agent is also present.

Grafana agent receives incoming spans for traces, and then outputs metrics to prometheus based on them. There is a very simple APMalike dashboard to show how you can build a watcher for trace latencies.

