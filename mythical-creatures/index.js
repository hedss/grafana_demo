const { api, tracer } = require('./tracing')();
const promClient = require('prom-client');
const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const logEntry = require('./logging');

// Prometheus
const app = express();
const register = promClient.register;
register.setContentType(promClient.Registry.OPENMETRICS_CONTENT_TYPE);

// Use JSON parsing in the request body
app.use(bodyParser.json());
let pgClient;

const Database = {
    GET: 0,
    ADD: 1,
    DELETE: 2,
};

const beasts = [
    'unicorn',
    'manticore',
    'illithid',
    'owlbear',
    'beholder',
];

// Status response bucket
const responseBucket = new promClient.Histogram({
    name: 'mythical_request_times',
    help: 'mythical_request_times',
    labelNames: ['method', 'status', 'beast'],
    buckets: [1, 4, 8, 10, 20, 50, 100, 200, 500, 1000],
    enableExemplars: true,
});

const databaseAction = async (action) => {
    if (action.method === Database.GET) {
        const results = await pgClient.query(`SELECT name from ${action.table}`);
        return results.rows;
    } else if (action.method === Database.ADD) {
        return await pgClient.query(`INSERT INTO ${action.table}(name) VALUES ($1)`, [ action.name ]);
    } else if (action.method === Database.DELETE) {
        return await pgClient.query(`DELETE FROM ${action.table} WHERE name = $1`, [ action.name ]);
    }

    logEntry({
        level: 'error',
        job: 'beasts',
        message: 'Method was not valid, throwing error',
    });
    throw new Error('Not a valid creature method!')
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
    const metrics = await register.metrics();
    res.send(await register.metrics());
});

// Generic GET endpoint
app.get('/:beast', async (req, res) => {
    const beast = req.params.beast;
    if (!beasts.includes(beast)) {
        res.status(404).send(`${beast} is not a valid beast`);
        metricBody.labels.status = "404";
        responseMetric(metricBody);
        console.log("INVALID BEAST!")
        return;
    }

    let metricBody = {
        labels: {
            method: 'GET',
            beast,
        },
        start: Date.now(),
    };

    // Retrieve all the Unicorn names
    try {
        const results = await databaseAction({
            method: Database.GET,
            table: beast,
        });

        // Metrics
        metricBody.labels.status = "200";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: 'beasts',
            message: `${beast} GET complete`,
        });

        res.send(results);
    } catch (err) {
        metricBody.labels.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: 'beasts',
            message: `${beast} GET error: ${err}`,
        });

        res.status(500).send(err);
    }
});

// Generic POST endpoint
app.post('/:beast', async (req, res) => {
    const beast = req.params.beast;
    if (!beasts.includes(beast)) {
        res.status(404).send(`${beast} is not a valid beast`);
        metricBody.labels.status = "404";
        responseMetric(metricBody);
        return;
    }

    let status = 201
    let metricBody = {
        labels: {
            method: 'POST',
            beast,
        },
        start: Date.now(),
    };

    if (!req.body || !req.body.name) {
        // Here we'd use 'respondToCall()' which would add a metric for the response
        // code
        metricBody.labels.status = "400";
        responseMetric(metricBody);
    }

    // Add a new unicorn name
    try {
        await databaseAction({
            method: Database.ADD,
            table: beast,
            name: req.body.name,
        });

        // Metrics
        metricBody.labels.status = "201";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: 'beasts',
            message: `${beast} POST complete`,
        });

        res.sendStatus(201);
    } catch (err) {
        // Metrics
        console.log(`error: ${err}`);
        metricBody.labels.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: 'beasts',
            message: `${beast} POST error: ${err}`,
        });

        res.status(500).send(err);
    }
});

// Generic DELETE endpoint
app.delete('/:beast', async (req, res) => {
    const beast = req.params.beast;
    if (!beasts.includes(beast)) {
        res.status(404).send(`${beast} is not a valid beast`);
        metricBody.labels.status = "404";
        responseMetric(metricBody);
        return;
    }

    let metricBody = {
        labels: {
            method: 'DELETE',
            beast,
        },
        start: Date.now(),
    };

    if (!req.body || !req.body.name) {
        // Here we'd use 'respondToCall()' which would add a metric for the response
        // code
        metricBody.labels.status = "400";
        responseMetric(metricBody);
    }

    // Delete a manticore name
    try {
        await databaseAction({
            method: Database.DELETE,
            table: beast,
            name: req.body.name,
        });

        // Metrics
        metricBody.labels.status = "204";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: 'beasts',
            message: `${beast} DELETE complete`,
        });

        res.sendStatus(204);
    } catch (err) {
        // Metrics
        console.log(`error: ${err}`);
        metricBody.labels.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: 'beasts',
            message: `${beast} DELETE error: ${err}`,
        });

        res.status(500).send(err);
    }
});

// Influx, create DB if it doesn't exist
const startServer = async () => {
    try {
        logEntry({
            level: 'info',
            job: 'beasts',
            message: 'Installing postgres client...',
        });
        pgClient = new Client({
            host: 'postgres',
            port: 5432,
            user: 'postgres',
            password: 'mythical',
        });

        await pgClient.connect();
        const results = await pgClient.query("SELECT COUNT(*) FROM pg_catalog.pg_database WHERE datname = 'beasts';");
        if (results.rows[0].exists === false) {
            logEntry({
                level: 'info',
                job: 'beasts',
                message: 'Database entry did not exist, creating...',
            });
            console.log('Creating database...');
            await pgClient.query('CREATE DATABASE beasts');
        }

        logEntry({
            level: 'info',
            job: 'beasts',
            message: 'Creating tables...',
        });

        // Can't use prepared statements with
        for (const beast of beasts) {
            console.log(beast);
            await pgClient.query(`CREATE TABLE IF NOT EXISTS ${beast}(id serial PRIMARY KEY, name VARCHAR (50) UNIQUE NOT NULL);`);
        }

        app.listen(4000);
        logEntry({
            level: 'info',
            job: 'beasts',
            message: 'Beasts server up and running...',
        });
    } catch (err) {
        logEntry({
            level: 'info',
            job: 'beasts',
            message: `Beasts server could not start, trying again in 5 seconds... ${err}`,
        });
        setTimeout(() => startServer(), 5000);
    }
};

startServer();
