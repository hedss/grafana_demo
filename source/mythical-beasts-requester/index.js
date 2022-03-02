const tracingUtils = require('./tracing')('requester', 'mythical-requester');
const { api, tracer, propagator } = tracingUtils;
const request = require('request-promise-native');
const { uniqueNamesGenerator, adjectives, colors } = require('unique-names-generator');
const logEntry = require('./logging')('requester');
const { nameSet, servicePrefix, spanTag }  = require('./endpoints')();

console.log(logEntry);

// We just keep going, requesting names and adding them
const makeRequest = async () => {
    const type = (Math.floor(Math.random() * 100) < 50) ? 'GET' : 'POST';
    const index = Math.floor(Math.random() * nameSet.length);
    const endpoint = nameSet[index];
    let headers = {};
    let error = false;

    // Create a new span
    const requestSpan = tracer.startSpan("requester");
    requestSpan.setAttribute(spanTag, endpoint);
    const { traceId } = requestSpan.spanContext();

    // Create a new context for this request
    api.context.with(api.trace.setSpan(api.context.active(), requestSpan), async () => {
        const start = Date.now();
        // Add the headers required for trace propagation
        headers = propagator(requestSpan);

        if (type === 'GET') {
            let names;
            try {
                const result = await request({
                    method: 'GET',
                    uri: `http://mythical-server:4000/${endpoint}`,
                    headers
                });
                logEntry({
                    level: 'info',
                    job: `${process.env.NAMESPACE}/${servicePrefix}-requester`,
                    endpointLabel: spanTag,
                    endpoint,
                    message: `traceID=${traceId} request="GET /${endpoint}" status=SUCCESS`,
                });
                names = JSON.parse(result);

                // Deletion probabilty is based on the array index.
                let delProb = (index / nameSet.length) * 100;
                if (Math.floor(Math.random() * 100) < delProb) {
                    if (names.length > 0) {
                        await request({
                            method: 'DELETE',
                            uri: `http://mythical-server:4000/${endpoint}`,
                            json: true,
                            headers,
                            body: { name: names[0].name },
                        });
                        logEntry({
                            level: 'info',
                            job: `${process.env.NAMESPACE}/${servicePrefix}-requester`,
                            endpointLabel: spanTag,
                            endpoint,
                            message: `traceID=${traceId} request="DELETE /${endpoint}/${names[0].name}" status=SUCCESS`,
                        });
                    }
                }
            } catch (err) {
                logEntry({
                    level: 'error',
                    job: `${process.env.NAMESPACE}/${servicePrefix}-requester`,
                    endpointLabel: spanTag,
                    endpoint,
                    message: `traceID=${traceId} request="DELETE /${endpoint}/${(names !== null) ? names[0].name : "unknown"}" status=FAILURE error="${err}"`,
                });
                console.log('Requester error');
                error = true;
            }
        } else {
            // Generate new name
            const randomName = uniqueNamesGenerator({ dictionaries: [adjectives, colors, adjectives] });
            const body = (Math.random() < 0.1) ? { whoops: "yes" } : { name : randomName };

            try {
                await request({
                    method: 'POST',
                    uri: `http://mythical-server:4000/${endpoint}`,
                    json: true,
                    headers,
                    body,
                });
                logEntry({
                    level: 'info',
                    job: `${process.env.NAMESPACE}/${servicePrefix}-requester`,
                    endpointLabel: spanTag,
                    endpoint,
                    message: `traceID=${traceId} request="POST /${endpoint}" status=SUCCESS`,
                });
            } catch (err) {
                logEntry({
                    level: 'error',
                    job: `${process.env.NAMESPACE}/${servicePrefix}-requester`,
                    endpointLabel: spanTag,
                    endpoint,
                    message: `traceID=${traceId} request="POST /${endpoint}" status=FAILURE error="${err}"`,
                });
                console.log('Requester error');
                error = true;
            }

        }
        logEntry({
            level: 'info',
            job: `${process.env.NAMESPACE}/mythical-beasts-requester`,
            endpointLabel: spanTag,
            endpoint,
            message: `traceID=${traceId} method=${type} target=/${endpoint} duration=${Date.now() - start}ms`,
        });

        // Set the status code as OK and end the span
        requestSpan.setStatus({ code: (!error) ? api.SpanStatusCode.OK : api.SpanStatusCode.ERROR });
        requestSpan.end();
    });

    // Sometime in the next two seconds, but larger than 100ms
    const nextReqIn = (Math.random() * 1000) + 100;
    setTimeout(() => makeRequest(), nextReqIn);
};

setTimeout(() => makeRequest(), 5000);
setTimeout(() => makeRequest(), 6000);
setTimeout(() => makeRequest(), 7000);
setTimeout(() => makeRequest(), 8000);
