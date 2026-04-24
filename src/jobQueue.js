const crypto = require('crypto');
const { executeCode } = require('./executor');

// In-memory store: jobId -> { status, result, createdAt }
const jobs = new Map();

// FIFO queue of pending job IDs
const queue = [];

// How long to keep completed/failed jobs before evicting (1 hour)
const JOB_TTL_MS = 60 * 60 * 1000;

// Whether the background worker is currently processing a job
let processing = false;

// Track in-flight promises for graceful shutdown
const inFlight = new Set();

/**
 * Submit a new job to the queue.
 * Returns the jobId immediately — execution happens in the background.
 */
const submitJob = (language, files, stdin, args, runTimeout, compileTimeout) => {
    const jobId = crypto.randomUUID();

    jobs.set(jobId, {
        status: 'pending',
        result: null,
        createdAt: Date.now(),
        language,
        files,
        stdin,
        args,
        runTimeout,
        compileTimeout,
    });

    queue.push(jobId);

    // Kick off the worker if it isn't already running
    setImmediate(processQueue);

    return jobId;
};

/**
 * Retrieve the current status and result of a job.
 * Returns null if the jobId is unknown.
 */
const getJobStatus = (jobId) => {
    const job = jobs.get(jobId);
    if (!job) return null;

    if (job.status === 'pending') {
        return { status: 'pending', result: null };
    }

    return {
        status: job.status,   // 'completed' | 'failed'
        result: job.result,
    };
};

/**
 * Background worker — processes one job at a time from the queue.
 * Re-schedules itself via setImmediate after each job so the event
 * loop stays responsive between jobs.
 */
const processQueue = async () => {
    if (processing || queue.length === 0) return;

    processing = true;
    const jobId = queue.shift();
    const job = jobs.get(jobId);

    // Job may have been evicted by TTL cleanup between enqueue and dequeue
    if (!job) {
        processing = false;
        if (queue.length > 0) setImmediate(processQueue);
        return;
    }

    const promise = executeCode(
        job.language,
        job.files,
        job.stdin,
        job.args,
        job.runTimeout,
        job.compileTimeout
    );

    inFlight.add(promise);

    try {
        const result = await promise;
        job.status = 'completed';
        job.result = result;
    } catch (err) {
        job.status = 'failed';
        job.result = { error: err.message };
    } finally {
        inFlight.delete(promise);
        processing = false;

        // Continue draining the queue
        if (queue.length > 0) setImmediate(processQueue);
    }
};

/**
 * Evict jobs older than JOB_TTL_MS that are no longer pending.
 * Runs on a 10-minute interval.
 */
const startCleanup = () => {
    const interval = setInterval(() => {
        const cutoff = Date.now() - JOB_TTL_MS;
        for (const [jobId, job] of jobs.entries()) {
            if (job.status !== 'pending' && job.createdAt < cutoff) {
                jobs.delete(jobId);
            }
        }
    }, 10 * 60 * 1000);

    // Don't let the cleanup timer prevent the process from exiting
    interval.unref();
};

/**
 * Wait for all currently in-flight executions to finish.
 * Call this during graceful shutdown before closing the server.
 */
const drainInFlight = () => {
    if (inFlight.size === 0) return Promise.resolve();
    return Promise.allSettled([...inFlight]);
};

module.exports = { submitJob, getJobStatus, processQueue, startCleanup, drainInFlight };
