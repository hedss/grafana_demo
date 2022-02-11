const tracing = require('./tracing')();
const request = require('request-promise-native');

// Tracing
const { api, tracer } = tracing;

// Logging system sends to Loki
const logEntry = async (details) => {
    const { message, level, job } = details;
    // Create a new span
    const logSpan = tracer.startSpan("log_to_loki");
    let error = false;
    let stream = {
        'level': level,
        'job': job,
    };
    if (details.creature) {
        stream['creature'] = details.creature;
    }

    try {
        await request(
            {
                uri: "http://loki:3100/loki/api/v1/push",
                method: 'POST',
                headers: {
                    'Content-type': 'application/json'
                },
                json: true,
                body: {
                    'streams': [
                        {
                            'stream': stream,
                            'values': [
                                [ `${Date.now() * 1000000}`, message ]
                            ]
                        }
                    ]
                }
            },
        );
    } catch (err) {
        console.log(`Logging error: ${err}`);
        error = true;
    }
    // Set the status code as OK and end the span
    logSpan.setStatus({ code: (!error) ? api.SpanStatusCode.OK : api.SpanStatusCode.ERROR });
    logSpan.end();
};

module.exports = logEntry;
