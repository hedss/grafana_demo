# grafana_demo

This is built on top of a demo I gave as part of my original interview at Grafana Labs.

It's been added to a bit, very roughly, acting as a small sandbox for various Grafana components, although my interests these days are mainly that around tracing in all of its forms.

Run via:
```
docker-compose up -d
```


## OpenTelemetry

All the interesting stuff here is in `mythical-creatures/index.js` and `http-requester/index.js`.

Each registers with Otel in the very first request by invoking `tracing.js`, which would usually be code in an NPM library used by all your JS services. For the auto-instrumented `mythical-creatures/index.js` server code, every subsequently requested module is then checked against the provided OTel auto-instrumentations and if there is a tracing pattern for it, it's bound to the relevant code.

This, for example, means that when Express receives a request, tracing is automatically invoked with spans being added as appropriate. Further calls from the endpoint method also get included in the trace as child/sibling spans.

The `http-requester/index.js` source is manually instrumented, as as such the `tracing.js` code for it does not include the OTel auto-instrumentations. We start with a single span when it requests an endpoint from the creatures service, and then use a small header propagation function (defined in `tracing.js`) to inject W3C spec. header information, so when the `mythical-creatures` server receives a request, the OTel auto-instrumentations unpack the trace information from the header of the request, then continues to use the parent span and trace rather than create a new one. All further auto-instrumentation occurs as normal.

The demo also outputs some metrics, both in the form of a counter and bucket (`requests` and `request_times`). General histogram rules occur for the bucket. Logs are output directly via Loki, by HTTP rather than stdout.

Grafana Agent however adds some extra functionality. As it receives incoming spans, it then outputs metrics for the Prometheus instance to scrape. It also auto-generates log lines based on the incoming spans.

There is a very simple APMalike dashboard to show how you can build a dashboard that looks at span metrics and auto-logged entries into a mini 'APM-alike' dashboard.

