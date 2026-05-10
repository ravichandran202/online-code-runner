const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const runtimes = require('../runtimes.json');

const TEMP_DIR = path.join(__dirname, '../temp');
const MAX_CONCURRENT_JOBS = parsePositiveInteger(process.env.MAX_CONCURRENT_JOBS, 4);
const MAX_QUEUE_SIZE = parsePositiveInteger(process.env.MAX_QUEUE_SIZE, 100);
const MAX_OUTPUT_BYTES = parsePositiveInteger(process.env.MAX_OUTPUT_BYTES, 1024 * 1024);

const queuedJobs = [];
let activeJobs = 0;

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getRuntimeConfig(lang) {
    return runtimes.find(r =>
        r.language === lang || r.aliases.includes(lang)
    );
}

function createQueueError() {
    const error = new Error(`Server is busy. Queue limit (${MAX_QUEUE_SIZE}) reached.`);
    error.code = 'QUEUE_LIMIT_EXCEEDED';
    error.statusCode = 429;
    error.details = {
        maxConcurrentJobs: MAX_CONCURRENT_JOBS,
        maxQueueSize: MAX_QUEUE_SIZE
    };
    return error;
}

function createOutputError(stage, maxOutputBytes) {
    const error = new Error(`Execution output exceeded limit of ${maxOutputBytes} bytes during ${stage} stage.`);
    error.code = 'OUTPUT_LIMIT_EXCEEDED';
    error.statusCode = 413;
    error.details = {
        stage,
        maxOutputBytes
    };
    return error;
}

function processQueue() {
    while (activeJobs < MAX_CONCURRENT_JOBS && queuedJobs.length > 0) {
        const job = queuedJobs.shift();
        activeJobs += 1;

        executeCodeInternal(...job.args)
            .then(job.resolve)
            .catch(job.reject)
            .finally(() => {
                activeJobs -= 1;
                processQueue();
            });
    }
}

function enqueueExecution(job) {
    if (queuedJobs.length >= MAX_QUEUE_SIZE) {
        job.reject(createQueueError());
        return;
    }

    queuedJobs.push(job);
    processQueue();
}

function runProcessWithLimit(jobDir, cmd, cmdArgs, timeout, stage, stdin = '', maxOutputBytes = MAX_OUTPUT_BYTES) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, cmdArgs, {
            cwd: jobDir,
            env: { ...process.env },
            timeout
        });

        let stdout = '';
        let stderr = '';
        let outputBytes = 0;
        let limitExceeded = false;

        const appendOutput = (buffer, stream) => {
            if (limitExceeded) {
                return;
            }

            outputBytes += buffer.length;
            if (outputBytes > maxOutputBytes) {
                limitExceeded = true;
                child.kill('SIGKILL');
                return;
            }

            const chunk = buffer.toString();
            if (stream === 'stdout') {
                stdout += chunk;
            } else {
                stderr += chunk;
            }
        };

        child.stdout.on('data', data => appendOutput(data, 'stdout'));
        child.stderr.on('data', data => appendOutput(data, 'stderr'));

        child.on('error', err => {
            reject(err);
        });

        child.on('close', (code, signal) => {
            if (limitExceeded) {
                reject(createOutputError(stage, maxOutputBytes));
                return;
            }

            resolve({
                stdout,
                stderr,
                code,
                signal,
                output: stdout + stderr
            });
        });

        if (stdin) {
            child.stdin.write(stdin);
        }
        child.stdin.end();
    });
}

async function executeCodeInternal(language, files, stdin, args = [], runTimeout = 3000, compileTimeout = 10000) {
    const runtimeConfig = getRuntimeConfig(language);
    if (!runtimeConfig) {
        throw new Error(`Unsupported language: ${language}`);
    }

    const jobId = crypto.randomUUID();
    const jobDir = path.join(TEMP_DIR, jobId);

    try {
        fs.mkdirSync(jobDir);

        files.forEach((file, index) => {
            const defaultName = (language === 'java' && index === 0)
                ? 'Main.java'
                : `main${index > 0 ? index : ''}.${getExtension(language)}`;
            const fileName = file.name || defaultName;
            fs.writeFileSync(path.join(jobDir, fileName), file.content);
        });

        const mainFile = files[0].name || (language === 'java' ? 'Main.java' : `main.${getExtension(language)}`);
        let compileResult = null;
        let runCmd = '';
        let runArgs = [];

        if (language === 'java') {
            runCmd = 'java';
            runArgs = [mainFile.replace('.java', '')];
            compileResult = await runProcessWithLimit(jobDir, 'javac', [mainFile], compileTimeout, 'compile');
        } else if (language === 'c') {
            runCmd = './main';
            compileResult = await runProcessWithLimit(jobDir, 'gcc', [mainFile, '-o', 'main'], compileTimeout, 'compile');
        } else if (language === 'cpp') {
            runCmd = './main';
            compileResult = await runProcessWithLimit(jobDir, 'g++', [mainFile, '-o', 'main'], compileTimeout, 'compile');
        } else if (language === 'go') {
            runCmd = './main';
            const initResult = await runProcessWithLimit(jobDir, 'go', ['mod', 'init', 'job'], compileTimeout, 'compile');
            if (initResult.code !== 0) {
                compileResult = initResult;
            } else {
                compileResult = await runProcessWithLimit(jobDir, 'go', ['build', '-o', 'main', '.'], compileTimeout, 'compile');
            }
        }

        if (compileResult && (compileResult.code !== 0 || compileResult.signal)) {
            return {
                compile: compileResult,
                run: { stdout: '', stderr: '', code: null, signal: null, output: '' }
            };
        }

        if (!runCmd) {
            if (language === 'python' || runtimes.find(r => r.language === 'python').aliases.includes(language)) {
                runCmd = 'python3';
                runArgs = [mainFile];
            } else if (language === 'javascript' || runtimes.find(r => r.language === 'javascript').aliases.includes(language)) {
                runCmd = 'node';
                runArgs = [mainFile];
            } else if (language === 'sql' || runtimes.find(r => r.language === 'sql').aliases.includes(language)) {
                const seedContent = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
                let userContent = fs.readFileSync(path.join(jobDir, mainFile), 'utf8');
                userContent = userContent.replace(/SHOW\s+TABLES\s*;?/gi, '.tables');
                userContent = userContent.replace(/DESCRIBE\s+(\w+)\s*;?/gi, '.schema $1');
                fs.writeFileSync(path.join(jobDir, mainFile), seedContent + '\n' + userContent);

                runCmd = 'sh';
                runArgs = ['-c', `sqlite3 -header -separator ' | ' < ${mainFile}`];
            }
        }

        if (runCmd !== 'sh') {
            runArgs.push(...args);
        }

        const runResult = await runProcessWithLimit(jobDir, runCmd, runArgs, runTimeout, 'run', stdin);

        return {
            compile: compileResult,
            run: runResult
        };
    } finally {
        if (fs.existsSync(jobDir)) {
            fs.rmSync(jobDir, { recursive: true, force: true });
        }
    }
}

function executeCode(language, files, stdin, args = [], runTimeout = 3000, compileTimeout = 10000) {
    return new Promise((resolve, reject) => {
        enqueueExecution({
            args: [language, files, stdin, args, runTimeout, compileTimeout],
            resolve,
            reject
        });
    });
}

function getExtension(lang) {
    switch (lang) {
        case 'python': return 'py';
        case 'javascript': return 'js';
        case 'go': return 'go';
        case 'java': return 'java';
        case 'c': return 'c';
        case 'cpp': return 'cpp';
        default: return 'txt';
    }
}

module.exports = { executeCode };
