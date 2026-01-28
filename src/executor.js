const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const runtimes = require('../runtimes.json');

const TEMP_DIR = path.join(__dirname, '../temp');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

const getRuntimeConfig = (lang, version) => {
    return runtimes.find(r =>
        r.language === lang || r.aliases.includes(lang)
    );
};

const executeCode = (language, files, stdin, args = [], runTimeout = 3000, compileTimeout = 10000) => {
    return new Promise(async (resolve, reject) => {
        const runtimeConfig = getRuntimeConfig(language);
        if (!runtimeConfig) {
            return reject(new Error(`Unsupported language: ${language}`));
        }

        const jobId = crypto.randomUUID();
        const jobDir = path.join(TEMP_DIR, jobId);

        try {
            fs.mkdirSync(jobDir);

            files.forEach((file, index) => {
                const fileName = file.name || `main${index > 0 ? index : ''}.${getExtension(language)}`;
                fs.writeFileSync(path.join(jobDir, fileName), file.content);
            });

            const mainFile = files[0].name || `main.${getExtension(language)}`;
            let compileResult = null;
            let runCmd = '', runArgs = [];

            // Helper to run a process
            const runProcess = (cmd, cmdArgs, timeout) => {
                return new Promise((res, rej) => {
                    const child = spawn(cmd, cmdArgs, {
                        cwd: jobDir,
                        env: { ...process.env },
                        timeout: timeout
                    });

                    let stdout = '', stderr = '';
                    child.stdout.on('data', d => stdout += d.toString());
                    child.stderr.on('data', d => stderr += d.toString());

                    child.on('close', (code, signal) => {
                        res({ stdout, stderr, code, signal, output: stdout + stderr });
                    });
                    child.on('error', err => {
                        // If error is ENOENT, it means command not found, which is different from timeout/crash
                        // But for simplicity/consistency with existing logic:
                        rej(err);
                    });
                });
            };

            // Compilation Stage
            if (language === 'java') {
                runCmd = 'java';
                runArgs = [mainFile.replace('.java', '')]; // Java runs class name
                compileResult = await runProcess('javac', [mainFile], compileTimeout);
            } else if (language === 'c') {
                runCmd = './main';
                compileResult = await runProcess('gcc', [mainFile, '-o', 'main'], compileTimeout);
            } else if (language === 'cpp') {
                runCmd = './main';
                compileResult = await runProcess('g++', [mainFile, '-o', 'main'], compileTimeout);
            } else if (language === 'go') {
                runCmd = './main';
                // Initialize module first
                const initResult = await runProcess('go', ['mod', 'init', 'job'], compileTimeout);
                if (initResult.code !== 0) {
                    compileResult = initResult;
                } else {
                    // Then build
                    compileResult = await runProcess('go', ['build', '-o', 'main', '.'], compileTimeout);
                }
            }

            // If compilation failed, return immediately
            if (compileResult && (compileResult.code !== 0 || compileResult.signal)) {
                fs.rmSync(jobDir, { recursive: true, force: true });
                return resolve({
                    compile: compileResult,
                    run: { stdout: '', stderr: '', code: null, signal: null, output: '' }
                });
            }

            // Run Stage logic adjustment based on runtime
            if (!runCmd) {
                if (language === 'python' || runtimes.find(r => r.language === 'python').aliases.includes(language)) {
                    runCmd = 'python3'; runArgs = [mainFile];
                } else if (language === 'javascript' || runtimes.find(r => r.language === 'javascript').aliases.includes(language)) {
                    runCmd = 'node'; runArgs = [mainFile];
                } else if (language === 'sql' || runtimes.find(r => r.language === 'sql').aliases.includes(language)) {
                    // Specific SQL setup (seed + cat)
                    const seedContent = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
                    let userContent = fs.readFileSync(path.join(jobDir, mainFile), 'utf8');
                    userContent = userContent.replace(/SHOW\s+TABLES\s*;?/gi, '.tables');
                    userContent = userContent.replace(/DESCRIBE\s+(\w+)\s*;?/gi, '.schema $1');
                    fs.writeFileSync(path.join(jobDir, mainFile), seedContent + '\n' + userContent);

                    runCmd = 'sqlite3';
                    // pipe via shell or just pass file? sqlite3 < file
                    // Spawning sqlite3 and piping via stdin is safer/easier than shell redirect in spawn args
                    // But we used shell before. Let's stick to shell for SQL for now to keep it working same way
                    runArgs = ['-header', '-separator', ' | '];
                    // Wait, previous impl used `sh -c sqlite3 < file`.
                    // Let's use direct execution if possible. 
                    // `sqlite3 db < file` -> `sqlite3 -init file`? No.
                    // Let's use `sh` for SQL to handle redirection reliably
                    runCmd = 'sh';
                    runArgs = ['-c', `sqlite3 -header -separator ' | ' < ${mainFile}`];
                }
            }

            // Add user args
            if (runCmd !== 'sh') {
                runArgs.push(...args);
            }

            // Execute Run Stage
            // We need to re-implement runProcess to handle stdin for run stage
            const child = spawn(runCmd, runArgs, {
                cwd: jobDir,
                env: { ...process.env },
                timeout: runTimeout
            });

            let stdout = '', stderr = '';
            if (stdin) {
                child.stdin.write(stdin);
                child.stdin.end();
            }

            child.stdout.on('data', d => stdout += d.toString());
            child.stderr.on('data', d => stderr += d.toString());

            child.on('close', (code, signal) => {
                fs.rmSync(jobDir, { recursive: true, force: true });
                resolve({
                    compile: compileResult, // could be null
                    run: { stdout, stderr, code, signal, output: stdout + stderr }
                });
            });

            child.on('error', (err) => {
                fs.rmSync(jobDir, { recursive: true, force: true });
                reject(err);
            });

        } catch (err) {
            if (fs.existsSync(jobDir)) fs.rmSync(jobDir, { recursive: true, force: true });
            reject(err);
        }
    });
};

const getExtension = (lang) => {
    switch (lang) {
        case 'python': return 'py';
        case 'javascript': return 'js';
        case 'go': return 'go';
        case 'java': return 'java';
        case 'c': return 'c';
        case 'cpp': return 'cpp';
        default: return 'txt';
    }
};

module.exports = { executeCode };
