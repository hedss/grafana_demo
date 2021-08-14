const promClient = require('prom-client');
const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const request = require('request-promise-native');
const os = require('os');
const { Client } = require('pg');

// Prometheus
const app = express();
const collectDefaultMetrics = promClient.collectDefaultMetrics;
const register = promClient.register;

app.use(bodyParser.json());

let pgClient;

const Database = {
    GET: 0,
    ADD: 1,
    DELETE: 2,
};

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
const requestCounter = new promClient.Counter({
    name: 'requests',
    help: 'Total numer of requests made.',
    labelNames: ['method', 'status', 'beast'],
});

// Status response bucket
const responseBucket = new promClient.Histogram({
    name: 'request_times',
    help: 'request_times',
    labelNames: ['method', 'status', 'beast'],
    buckets: [1, 4, 8, 10, 20, 50, 100, 200, 500, 1000],
});

const databaseAction = async (action) => {
    const table = (action.table === 'unicorns') ? 'unicorns' : 'manticores';
    if (action.method === Database.GET) {
        const statement = `SELECT name from ${table}`;
        const results = await pgClient.query(statement);
        return results.rows;
    } else if (action.method === Database.ADD) {
        const statement = `INSERT INTO ${table}(name) VALUES ('${action.name}')`;
        return await pgClient.query(statement);
    } else if (action.method === Database.DELETE) {
        const statement = `DELETE FROM ${table} WHERE name = '${action.name}'`;
        return await pgClient.query(statement);
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
    responseBucket.observe(details.labels, timeMs);
};

app.get('/metrics', (req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(register.metrics());
});

app.get('/unicorn', async (req, res) => {
    let metricBody = {
        labels: {
            method: 'GET',
            beast: 'unicorn',
        },
        start: Date.now(),
    };

    // Retrieve all the Unicorn names
    try {
        const results = await databaseAction({
            method: Database.GET,
            table: 'unicorns',
        });

        // Metrics
        metricBody.status = "200";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: 'beasts',
            message: 'Unicorn GET complete',
        });               

        res.send(results);
    } catch (err) {
        metricBody.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: 'beasts',
            message: `Unicorn GET error: ${err}`,
        });            

        res.status(500).send(err);
    }
});

app.post('/unicorn', async (req, res) => {
    let metricBody = {
        labels: {
            method: 'POST',
            beast: 'unicorn',
        },
        start: Date.now(),
    };

    if (!req.body || !req.body.name) {
        // Here we'd use 'respondToCall()' which would add a metric for the response
        // code
        metricBody.status = "400";
        responseMetric(metricBody);
    }

    // Add a new unicorn name
    try {
        await databaseAction({
            method: Database.ADD,
            table: 'unicorns',
            name: req.body.name,
        });

        // Metrics
        metricBody.status = "201";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: 'beasts',
            message: 'Unicorn POST complete',
        });               

        res.sendStatus(201);
    } catch (err) {
        // Metrics
        console.log(`error: ${err}`);
        metricBody.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: 'beasts',
            message: `Unicorn POST error: ${err}`,
        });            

        res.status(500).send(err);
    }
});

app.delete('/unicorn', async (req, res) => {
    let metricBody = {
        labels: {
            method: 'DELETE',
            beast: 'unicorn',
        },
        start: Date.now(),
    };

    if (!req.body || !req.body.name) {
        // Here we'd use 'respondToCall()' which would add a metric for the response
        // code
        metricBody.status = "400";
        responseMetric(metricBody);
    }

    // Delete a unicorn name
    try {
        await databaseAction({
            method: Database.DELETE,
            table: 'unicorns',
            name: req.body.name,
        });

        // Metrics
        metricBody.status = "204";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: 'beasts',
            message: 'Unicorn DELETE complete',
        });               

        res.sendStatus(204);
    } catch (err) {
        // Metrics
        console.log(`error: ${err}`);
        metricBody.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: 'beasts',
            message: `Unicorn DELETE error: ${err}`,
        });            

        res.status(500).send(err);
    }
});

app.get('/manticore', async (req, res) => {
    let metricBody = {
        labels: {
            method: 'GET',
            beast: 'manticore',
        },
        start: Date.now(),
    };

    // Retrieve all the Unicorn names
    try {
        const results = await databaseAction({
            method: Database.GET,
            table: 'manticores',
        });

        // Metrics
        metricBody.status = "200";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: 'beasts',
            message: 'Manticore GET complete',
        });               

        res.send(results);
    } catch (err) {
        metricBody.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: 'beasts',
            message: `Manticore GET error: ${err}`,
        });            

        res.status(500).send(err);
    }
});

app.post('/manticore', async (req, res) => {
    let status = 201
    let metricBody = {
        labels: {
            method: 'POST',
            beast: 'manticore',
        },
        start: Date.now(),
    };

    if (!req.body || !req.body.name) {
        // Here we'd use 'respondToCall()' which would add a metric for the response
        // code
        metricBody.status = "400";
        responseMetric(metricBody);
    }

    // Add a new unicorn name
    try {
        await databaseAction({
            method: Database.ADD,
            table: 'manticores',
            name: req.body.name,
        });

        // Metrics
        metricBody.status = "201";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: 'beasts',
            message: 'Manticore POST complete',
        });               

        res.sendStatus(201);
    } catch (err) {
        // Metrics
        console.log(`error: ${err}`);
        metricBody.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: 'beasts',
            message: `Manticore POST error: ${err}`,
        });            

        res.status(500).send(err);
    }
});

app.delete('/manticore', async (req, res) => {
    let metricBody = {
        labels: {
            method: 'DELETE',
            beast: 'manticore',
        },
        start: Date.now(),
    };

    if (!req.body || !req.body.name) {
        // Here we'd use 'respondToCall()' which would add a metric for the response
        // code
        metricBody.status = "400";
        responseMetric(metricBody);
    }

    // Delete a manticore name
    try {
        await databaseAction({
            method: Database.DELETE,
            table: 'manticores',
            name: req.body.name,
        });

        // Metrics
        metricBody.status = "204";
        responseMetric(metricBody);

        logEntry({
            level: 'info',
            job: 'beasts',
            message: 'Manticore DELETE complete',
        });               

        res.sendStatus(204);
    } catch (err) {
        // Metrics
        console.log(`error: ${err}`);
        metricBody.status = "500";
        responseMetric(metricBody);

        logEntry({
            level: 'error',
            job: 'beasts',
            message: `Manticore DELETE error: ${err}`,
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
        await pgClient.query('CREATE TABLE IF NOT EXISTS unicorns(id serial PRIMARY KEY, name VARCHAR (50) UNIQUE NOT NULL);');
        await pgClient.query('CREATE TABLE IF NOT EXISTS manticores(id serial PRIMARY KEY, name VARCHAR (50) UNIQUE NOT NULL);');

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
            message: 'Beasts server could not start, trying again in 5 seconds...',
        });            
        setTimeout(() => startServer(), 5000);
    }
};

startServer();
