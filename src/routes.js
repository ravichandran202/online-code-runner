const express = require('express');
const router = express.Router();
const runtimes = require('../runtimes.json');
const { executeCode } = require('./executor');

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
router.post('/execute', async (req, res) => {
    try {
        const { language, version, files, stdin, args, run_timeout, compile_timeout } = req.body;

        if (!language || !files || !files.length) {
            return res.status(400).json({ message: 'Language and files are required' });
        }

        const result = await executeCode(language, files, stdin, args, run_timeout, compile_timeout);

        res.json({
            language: language,
            version: version || runtimes.find(r => r.language === language || r.aliases.includes(language))?.version || "*",
            run: result.run,
            compile: result.compile
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Execution failed', error: error.message });
    }
});

module.exports = router;
