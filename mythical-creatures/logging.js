const request = require('request-promise-native');

// Logging system sends to Loki
const logEntry = async (details) => {
    const { message, level, job } = details;
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
                            'stream': {
                                'level': level,
                                'job': job,
                            },
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
    }
};

module.exports = logEntry;
