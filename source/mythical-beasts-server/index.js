const { api } = require('./tracing')('server', 'mythical-server');
const promClient = require('prom-client');
const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const logEntry = require('./logging')('server');
const { nameSet, servicePrefix, spanTag }  = require('./endpoints')();

console.log(nameSet);
console.log(servicePrefix);
console.log(spanTag);

// Prometheus
const app = express();
const register = promClient.register;
register.setContentType(promClient.Registry.OPENMETRICS_CONTENT_TYPE);

// Use JSON parsing in the request body
app.use(bodyParser.json());
let pgClient;

const Database = {
    GET: 0,
    POST: 1,
    DELETE: 2,
};

// Status response bucket
const responseBucket = new promClient.Histogram({
    name: 'mythical_request_times',
    help: 'mythical_request_times',
    labelNames: ['method', 'status', spanTag],
    buckets: [1, 4, 8, 10, 20, 50, 100, 200, 500, 1000],
    enableExemplars: true,
});

const databaseAction = async (action) => {
    if (action.method === Database.GET) {
        const results = await pgClient.query(`SELECT name from ${action.table}`);
        return results.rows;
    } else if (action.method === Database.POST) {
        return await pgClient.query(`INSERT INTO ${action.table}(name) VALUES ($1)`, [ action.name ]);
    } else if (action.method === Database.DELETE) {
        return await pgClient.query(`DELETE FROM ${action.table} WHERE name = $1`, [ action.name ]);
    }

    logEntry({
        level: 'error',
        job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
        message: 'Method was not valid, throwing error',
    });
    throw new Error(`Not a valid ${spanTag} method!`)
}

const responseMetric = (details) => {
    const timeMs = Date.now() - details.start;
    const spanContext = api.trace.getSpan(api.context.active()).spanContext();
    responseBucket.observe({
        labels: details.labels,
        value: timeMs,
        exemplarLabels: {
            traceId: spanContext.traceId,
            spanID: spanContext.spanId,
        },
    });
};

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
});

// Generic GET endpoint
app.get('/:endpoint', async (req, res) => {
    const endpoint = req.params.endpoint;

    let metricBody = {
        labels: {
            method: 'GET',
        },
        start: Date.now(),
    };
    metricBody.labels[spanTag] = endpoint;

    if (!nameSet.includes(endpoint)) {
        res.status(404).send(`${endpoint} is not a valid endpoint`);
        metricBody.labels.status = "404";
        responseMetric(metricBody);
        return;
    }

    // Retrieve all the names
    try {
        const results = await databaseAction({
            method: Database.GET,
            table: endpoint,
        });

        // Metrics
        metricBody.labels.status = "200";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            endpointLabel: spanTag,
            endpoint,
            message: `${endpoint} GET complete`,
        });

        res.send(results);
    } catch (err) {
        metricBody.labels.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            endpointLabel: spanTag,
            endpoint,
            message: `${endpont} GET error: ${err}`,
        });

        res.status(500).send(err);
    }
});

// Generic POST endpoint
app.post('/:endpoint', async (req, res) => {
    const endpoint = req.params.endpoint;
    let metricBody = {
        labels: {
            method: 'POST',
        },
        start: Date.now(),
    };
    metricBody.labels[spanTag] = endpoint;

    if (!nameSet.includes(endpoint)) {
        res.status(404).send(`${endpoint} is not a valid endpoint`);
        metricBody.labels.status = "404";
        responseMetric(metricBody);
        return;
    }

    if (!req.body || !req.body.name) {
        // Here we'd use 'respondToCall()' which would POST a metric for the response
        // code
        metricBody.labels.status = "400";
        responseMetric(metricBody);
    }

    // POST a new unicorn name
    try {
        await databaseAction({
            method: Database.POST,
            table: endpoint,
            name: req.body.name,
        });

        // Metrics
        metricBody.labels.status = "201";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            endpointLabel: spanTag,
            endpoint,
            message: `${endpoint} POST complete`,
        });

        res.sendStatus(201);
    } catch (err) {
        // Metrics
        console.log(`error: ${err}`);
        metricBody.labels.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            endpointLabel: spanTag,
            endpoint,
            message: `${endpoint} POST error: ${err}`,
        });

        res.status(500).send(err);
    }
});

// Generic DELETE endpoint
app.delete('/:endpoint', async (req, res) => {
    const endpoint = req.params.endpoint;
    let metricBody = {
        labels: {
            method: 'DELETE',
        },
        start: Date.now(),
    };
    metricBody.labels[spanTag] = endpoint;

    if (!nameSet.includes(endpoint)) {
        res.status(404).send(`${endpoint} is not a valid endpoint`);
        metricBody.labels.status = "404";
        responseMetric(metricBody);
        return;
    }

    if (!req.body || !req.body.name) {
        // Here we'd use 'respondToCall()' which would POST a metric for the response
        // code
        metricBody.labels.status = "400";
        responseMetric(metricBody);
    }

    // Delete a manticore name
    try {
        await databaseAction({
            method: Database.DELETE,
            table: endpoint,
            name: req.body.name,
        });

        // Metrics
        metricBody.labels.status = "204";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            endpointLabel: spanTag,
            endpoint,
            message: `${endpoint} DELETE complete`,
        });

        res.sendStatus(204);
    } catch (err) {
        // Metrics
        console.log(`error: ${err}`);
        metricBody.labels.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            endpointLabel: spanTag,
            endpoint,
            message: `${endpoint} DELETE error: ${err}`,
        });

        res.status(500).send(err);
    }
});

// Influx, create DB if it doesn't exist
const startServer = async () => {
    try {
        logEntry({
            level: 'info',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            message: 'Installing postgres client...',
        });
        pgClient = new Client({
            host: 'mythical-database',
            port: 5432,
            user: 'postgres',
            password: 'mythical',
        });

        await pgClient.connect();
        const results = await pgClient.query(`SELECT COUNT(*) FROM pg_catalog.pg_database WHERE datname = '${spanTag}';`);
        if (results.rows[0].exists === false) {
            logEntry({
                level: 'info',
                job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
                message: 'Database entry did not exist, creating...',
            });
            console.log('Creating database...');
            await pgClient.query(`CREATE DATABASE ${spanTag}`);
        }

        logEntry({
            level: 'info',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            message: 'Creating tables...',
        });

        // Can't use prepared statements with
        for (const endpoint of nameSet) {
            console.log(endpoint);
            await pgClient.query(`CREATE TABLE IF NOT EXISTS ${endpoint}(id serial PRIMARY KEY, name VARCHAR (50) UNIQUE NOT NULL);`);
        }

        app.listen(4000);
        logEntry({
            level: 'info',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            message: `${servicePrefix} server up and running...`,
        });
    } catch (err) {
        logEntry({
            level: 'info',
            job: `${process.env.NAMESPACE}/${servicePrefix}-server`,
            message: `${servicePrefix} server could not start, trying again in 5 seconds... ${err}`,
        });
        setTimeout(() => startServer(), 5000);
    }
};

startServer();
