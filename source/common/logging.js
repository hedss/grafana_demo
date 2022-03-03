const tracing = require('./tracing')();
const request = require('request-promise-native');

module.exports = (context) => {
    // Tracing
    const { api, tracer } = tracing;

    // Logging system sends to Loki
    const logEntry = async (details) => {
        const { message, level, job, endpointLabel, endpoint } = details;
        let logSpan;
        if (context === 'requester') {
            // Create a new span
            logSpan = tracer.startSpan("log_to_loki");
        }
        let error = false;
        let stream = {
            level,
            job,
        };
        if (endpoint) {
            stream[endpointLabel] = endpoint;
        }

        try {
            await request(
                {
                    uri: process.env.LOGS_TARGET,
                    method: 'POST',
                    headers: {
                        'Content-type': 'application/json'
                    },
                    json: true,
                    body: {
                        'streams': [
                            {
                                stream,
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
        if (context === 'requester') {
            // Set the status code as OK and end the span
            logSpan.setStatus({ code: (!error) ? api.SpanStatusCode.OK : api.SpanStatusCode.ERROR });
            logSpan.end();
        }
    };

    return logEntry;
}
