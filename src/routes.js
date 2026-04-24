const express = require('express');
const router = express.Router();
const runtimes = require('../runtimes.json');
const { submitJob, getJobStatus } = require('./jobQueue');

// GET /api/v2/runtimes
router.get('/runtimes', (req, res) => {
    res.json(runtimes);
});

// GET /api/v1/ncs/packages
router.get('/packages', (req, res) => {
    const packages = runtimes.map(r => ({
        language: r.language,
        language_version: r.version,
        installed: true
    }));
    res.json(packages);
});

// POST /api/v1/ncs/packages
router.post('/packages', (req, res) => {
    const { language, version } = req.body;
    const pkg = runtimes.find(r => r.language === language || r.aliases.includes(language));

    if (!pkg) {
        return res.status(400).json({ message: `Language ${language} not supported` });
    }

    res.json({
        language: pkg.language,
        version: pkg.version
    });
});

// DELETE /api/v1/ncs/packages
router.delete('/packages', (req, res) => {
    const { language, version } = req.body;
    const pkg = runtimes.find(r => r.language === language || r.aliases.includes(language));

    if (!pkg) {
        return res.status(400).json({ message: `Language ${language} not supported` });
    }

    res.json({
        language: pkg.language,
        version: pkg.version
    });
});

// POST /api/v1/ncs/execute
// Accepts the same request body as before but returns immediately with a
// job ID (HTTP 202 Accepted). Execution happens in the background.
router.post('/execute', (req, res) => {
    const { language, version, files, stdin, args, run_timeout, compile_timeout } = req.body;

    if (!language || !files || !files.length) {
        return res.status(400).json({ message: 'Language and files are required' });
    }

    const jobId = submitJob(language, files, stdin, args, run_timeout, compile_timeout);

    res.status(202).json({ jobId, status: 'pending' });
});

// GET /api/v1/ncs/jobs/:jobId
// Poll this endpoint to retrieve the result of a previously submitted job.
router.get('/jobs/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = getJobStatus(jobId);

    if (!job) {
        return res.status(404).json({ message: `Job ${jobId} not found` });
    }

    if (job.status === 'pending') {
        return res.json({ jobId, status: 'pending' });
    }

    // completed or failed
    res.json({ jobId, status: job.status, result: job.result });
});

module.exports = router;
