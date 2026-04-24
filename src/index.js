const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');
const { startCleanup, drainInFlight } = require('./jobQueue');

const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 2000;

app.use(cors({
    origin: [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:2000",
        "https://namma-coding-shaale.in",
        "https://nammacodingshaale.in",
        "https://nammacodingshaale.up.railway.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(bodyParser.json());

app.use('/api/v1/ncs', routes);

app.get('/', (req, res) => {
    res.json({ message: 'Welcome To Namma Coding Shaale Code Runner....' });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Start the TTL-based cleanup timer for completed jobs
    startCleanup();
});

// Graceful shutdown: stop accepting new connections, wait for in-flight
// code executions to finish, then exit cleanly.
const shutdown = async (signal) => {
    console.log(`${signal} received — shutting down gracefully`);

    server.close(async () => {
        console.log('HTTP server closed. Waiting for in-flight jobs...');
        await drainInFlight();
        console.log('All in-flight jobs finished. Exiting.');
        process.exit(0);
    });

    // Force-exit after 30 s if jobs are still running
    setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 30_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
