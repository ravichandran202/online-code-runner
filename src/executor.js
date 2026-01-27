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

const executeCode = (language, files, stdin, args = []) => {
    return new Promise(async (resolve, reject) => {
        const runtimeConfig = getRuntimeConfig(language);
        if (!runtimeConfig) {
            return reject(new Error(`Unsupported language: ${language}`));
        }

        const jobId = crypto.randomUUID();
        const jobDir = path.join(TEMP_DIR, jobId);

        try {
            // Create job directory
            fs.mkdirSync(jobDir);

            // Write files
            files.forEach((file, index) => {
                const fileName = file.name || `main${index > 0 ? index : ''}.${getExtension(language)}`;
                fs.writeFileSync(path.join(jobDir, fileName), file.content);
            });

            const mainFile = files[0].name || `main.${getExtension(language)}`;

            // Construct Docker command
            // Note: We mount the job directory to /code in the container
            // We set working directory to /code
            // We add resource limits (basic)

            let runCmd = [];

            // Execution Command Construction (Direct Process)
            let cmd, cmdArgs;

            if (language === 'python' || runtimes.find(r => r.language === 'python').aliases.includes(language)) {
                cmd = 'python3';
                cmdArgs = [mainFile];
            } else if (language === 'javascript' || runtimes.find(r => r.language === 'javascript').aliases.includes(language)) {
                cmd = 'node';
                cmdArgs = [mainFile];
            } else if (language === 'go' || runtimes.find(r => r.language === 'go').aliases.includes(language)) {
                // Go needs environment variable for cache or it complains in some read-only envs, but here we are in temp dir
                cmd = 'go';
                cmdArgs = ['run', mainFile];
            } else if (language === 'java' || runtimes.find(r => r.language === 'java').aliases.includes(language)) {
                // Java: Compile then Run
                // Single command chain for simplicity in child_process: "javac Main.java && java Main"
                cmd = 'sh';
                cmdArgs = ['-c', `javac ${mainFile} && java ${mainFile.replace('.java', '')}`];
            } else if (language === 'c' || runtimes.find(r => r.language === 'c').aliases.includes(language)) {
                cmd = 'sh';
                cmdArgs = ['-c', `gcc ${mainFile} -o main && ./main`];
            } else if (language === 'cpp' || runtimes.find(r => r.language === 'cpp').aliases.includes(language)) {
                cmd = 'sh';
                cmdArgs = ['-c', `g++ ${mainFile} -o main && ./main`];
            }

            // Append user arguments if they exist and it's not a shell chained command (simplification)
            // For sh -c, args would need to be inside the string, skipping complex arg handling for shell ones for now
            if (!['sh'].includes(cmd)) {
                cmdArgs.push(...args);
            }

            // Spawn the process directly
            // env: {} clears env vars for security (basic). We inherit nothing.
            // But we might need PATH. So we set a basic PATH.
            const child = spawn(cmd, cmdArgs, {
                cwd: jobDir,
                env: { PATH: process.env.PATH }, // Minimal env
                timeout: 5000 // 5s hard timeout
            });

            let stdout = '';
            let stderr = '';

            if (stdin) {
                child.stdin.write(stdin);
                child.stdin.end();
            }

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                // Cleanup
                fs.rmSync(jobDir, { recursive: true, force: true });

                resolve({
                    stdout,
                    stderr,
                    code,
                    output: stdout
                });
            });

            child.on('error', (err) => {
                fs.rmSync(jobDir, { recursive: true, force: true });
                reject(err);
            });

        } catch (err) {
            if (fs.existsSync(jobDir)) {
                fs.rmSync(jobDir, { recursive: true, force: true });
            }
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
