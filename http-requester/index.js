const request = require('request-promise-native');
const { uniqueNamesGenerator, adjectives, colors } = require('unique-names-generator');

// Logging system sends to Loki
const logEntry = async (details) => {
    const { message, level, job } = details;
    try {
        await request(
            {
                uri: "http://loki:3100/loki/api/v1/push",
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

// We just keep going, requesting names and adding them
const makeRequest = async () => {
    const type = (Math.floor(Math.random() * 100) < 50) ? 'GET' : 'POST';
    const beast = (Math.floor(Math.random() * 100) < 75) ? 'unicorn' : 'manticore';

    if (type === 'GET') {
        try {
            const result = await request({
                method: 'GET',
                uri: `http://creatures:4000/${beast}`,
            });
            logEntry({
                level: 'info',
                job: 'requester',
                message: `Beast names retrieved for ${beast}`,
            });
            const names = JSON.parse(result);

            // Delete more manticores than Unicorns
            let delProb;
            if (beast === 'unicorn') {
                delProb = 50;
            } else {
                delProb = 70;
            }
            if (Math.floor(Math.random() * 100) < delProb) {
                if (result.length > 0) {
                    await request({
                        method: 'DELETE',
                        uri: `http://creatures:4000/${beast}`,
                        json: true,
                        body: { name: names[0].name },
                    });
                    logEntry({
                        level: 'info',
                        job: 'requester',
                        message: `Beast name ${result[0]} deleted for ${beast}`,
                    });
                }
            }
        } catch (err) {
            logEntry({
                level: 'error',
                job: 'requester',
                message: `Error in request to mythical beasts server: ${err}`,
            });                        
            console.log('Requester error');
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
                body,
            });
            logEntry({
                level: 'info',
                job: 'requester',
                message: `Beast name pushed for ${beast}`,
            });                        
        } catch (err) {
            logEntry({
                level: 'error',
                job: 'requester',
                message: `Error in request to mythical beasts server: ${err}`,
            });                        
            console.log('Requester error');
        }
    }

    // Sometime in the next two seconds, but larger than 100ms
    const nextReqIn = (Math.random() * 1000) + 100;
    setTimeout(() => makeRequest(), nextReqIn);
};

setTimeout(() => makeRequest(), 5000);
setTimeout(() => makeRequest(), 6000);
setTimeout(() => makeRequest(), 7000);
setTimeout(() => makeRequest(), 8000);
