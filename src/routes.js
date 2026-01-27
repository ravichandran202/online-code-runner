const express = require('express');
const router = express.Router();
const runtimes = require('../runtimes.json');
const { executeCode } = require('./executor');

// GET /api/v2/runtimes
router.get('/runtimes', (req, res) => {
    res.json(runtimes);
});

// POST /api/v2/execute
router.post('/execute', async (req, res) => {
    try {
        const { language, version, files, stdin, args } = req.body;

        if (!language || !files || !files.length) {
            return res.status(400).json({ message: 'Language and files are required' });
        }

        const result = await executeCode(language, files, stdin, args);
        res.json({ run: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Execution failed', error: error.message });
    }
});

module.exports = router;
