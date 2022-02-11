const tracingUtils = require('./tracing')();
const { api, tracer, propagator } = tracingUtils;
const request = require('request-promise-native');
const { uniqueNamesGenerator, adjectives, colors } = require('unique-names-generator');
const logEntry = require('./logging');

const beasts = [
    'unicorn',
    'manticore',
    'illithid',
    'owlbear',
    'beholder',
];

// We just keep going, requesting names and adding them
const makeRequest = async () => {
    const type = (Math.floor(Math.random() * 100) < 50) ? 'GET' : 'POST';
    const index = Math.floor(Math.random() * beasts.length);
    const beast = beasts[index];
    let headers = {};
    let error = false;

    // Create a new span
    const requestSpan = tracer.startSpan("requester");
    requestSpan.setAttribute('creature', beast);
    const { traceId } = requestSpan.spanContext();

    // Create a new context for this request
    api.context.with(api.trace.setSpan(api.context.active(), requestSpan), async () => {
        const start = Date.now();
        // Add the headers required for trace propagation
        headers = propagator(requestSpan);

        if (type === 'GET') {
            try {
                const result = await request({
                    method: 'GET',
                    uri: `http://creatures:4000/${beast}`,
                    headers
                });
                logEntry({
                    level: 'info',
                    job: 'requester',
                    creature: beast,
                    message: `traceID=${traceId} request="GET /${beast}" status=SUCCESS`,
                });
                const names = JSON.parse(result);

                // Deletion probabilty is based on the array index.
                let delProb = (index / beasts.length) * 100;
                if (Math.floor(Math.random() * 100) < delProb) {
                    if (names.length > 0) {
                        await request({
                            method: 'DELETE',
                            uri: `http://creatures:4000/${beast}`,
                            json: true,
                            headers,
                            body: { name: names[0].name },
                        });
                        logEntry({
                            level: 'info',
                            job: 'requester',
                            creature: beast,
                            message: `traceID=${traceId} request="DELETE /${beast}/${names[0].name}" status=SUCCESS`,
                        });
                    }
                }
            } catch (err) {
                logEntry({
                    level: 'error',
                    job: 'requester',
                    creature: beast,
                    message: `traceID=${traceId} request="DELETE /${beast}/${names[0].name}" status=FAILURE error="${err}"`,
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
                    uri: `http://creatures:4000/${beast}`,
                    json: true,
                    headers,
                    body,
                });
                logEntry({
                    level: 'info',
                    job: 'requester',
                    creature: beast,
                    message: `traceID=${traceId} request="POST /${beast}" status=SUCCESS`,
                });
            } catch (err) {
                logEntry({
                    level: 'error',
                    job: 'requester',
                    creature: beast,
                    message: `traceID=${traceId} request="POST /${beast}" status=FAILURE error="${err}"`,
                });
                console.log('Requester error');
                error = true;
            }

        }
        logEntry({
            level: 'info',
            job: 'requester',
            creature: beast,
            message: `traceID=${traceId} method=${type} target=/${beast} duration=${Date.now() - start}ms`,
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
