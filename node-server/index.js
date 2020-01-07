const promClient = require('prom-client');
const express = require('express');
const { exec } = require('child_process');
const request = require('request-promise-native');

const app = express();
const collectDefaultMetrics = promClient.collectDefaultMetrics;
const interval = collectDefaultMetrics();
const register = promClient.register;

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

// Total number of requests made
const reqCounter = new promClient.Counter({
    name: 'request_total',
    help: 'Total numer of requests made to process.',
});

// Current CPU temperature
const loadGauge = new promClient.Gauge({
    name: 'load_average',
    help: 'The load average.',
});
function getLoadAverage() {
    exec('cat /proc/loadavg', (err, text) => {
        if (err) {
          throw err;
        }
        // Get overall average from last minute
        const matchLoad = text.match(/(\d+\.\d+)\s+/);
        if (matchLoad) {
          const load = parseFloat(matchLoad[1]);
          loadGauge.set(load);
          logEntry({
            level: 'info',
            message: `New loadaverage: ${load}`,
            job: 'nodeJob',
          });          
        }
      });
}

setInterval(() => getLoadAverage(), 5000);

app.get('/metrics', (req, res) => {
    reqCounter.inc();
    res.set('Content-Type', register.contentType);
    res.send(register.metrics());
    logEntry({
        level: 'info',
        message: 'Upped metric counter',
        job: 'nodeJob',
    });
});

app.get('/test', (req, res) => {
    reqCounter.inc();
    res.send("All is good\n");
    logEntry({
        level: 'error',
        message: 'Test point hit',
        job: 'nodeJob',
    });    
});

logEntry({
    level: 'info',
    message: 'Set up app for listening',
    job: 'nodeJob',
});
logEntry({
    level: 'squirrel',
    message: 'I am a rogue squirrel!',
    job: 'squirrelJob',
});
app.listen(4000);
