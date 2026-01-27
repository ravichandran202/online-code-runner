const assert = require('assert');

const API_URL = 'http://localhost:2000/api/v2';

async function testRuntimes() {
    console.log('Testing GET /runtimes...');
    const res = await fetch(`${API_URL}/runtimes`);
    const data = await res.json();

    assert.ok(Array.isArray(data), 'Runtimes should be an array');
    console.log('Runtimes:', data.map(r => r.language).join(', '));
    console.log('PASS: GET /runtimes\n');
}

async function testExecutePython() {
    console.log('Testing POST /execute (Python)...');
    const payload = {
        language: 'python',
        version: '3.10.0',
        files: [
            {
                content: 'print("Hello from Python 3.10")'
            }
        ]
    };

    const res = await fetch(`${API_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();

    console.log('Response:', JSON.stringify(data, null, 2));
    assert.strictEqual(data.run.stdout.trim(), 'Hello from Python 3.10');
    console.log('PASS: POST /execute (Python)\n');
}

async function testExecuteNode() {
    console.log('Testing POST /execute (Node.js)...');
    const payload = {
        language: 'javascript',
        version: '18.15.0',
        files: [
            {
                content: 'console.log("Hello from Node.js")'
            }
        ]
    };

    const res = await fetch(`${API_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();

    console.log('Response:', JSON.stringify(data, null, 2));
    assert.strictEqual(data.run.stdout.trim(), 'Hello from Node.js');
    console.log('PASS: POST /execute (Node.js)\n');
}

async function testExecuteJava() {
    console.log('Testing POST /execute (Java)...');
    const payload = {
        language: 'java',
        version: '17.0.0',
        files: [
            {
                name: 'Main.java',
                content: 'public class Main { public static void main(String[] args) { System.out.println("Hello from Java 17"); } }'
            }
        ]
    };

    const res = await fetch(`${API_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();

    console.log('Response:', JSON.stringify(data, null, 2));
    assert.strictEqual(data.run.stdout.trim(), 'Hello from Java 17');
    console.log('PASS: POST /execute (Java)\n');
}

async function testExecuteC() {
    console.log('Testing POST /execute (C)...');
    const payload = {
        language: 'c',
        version: '12.0.0',
        files: [
            {
                content: '#include <stdio.h>\nint main() { printf("Hello from C\\n"); return 0; }'
            }
        ]
    };

    const res = await fetch(`${API_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();

    console.log('Response:', JSON.stringify(data, null, 2));
    assert.strictEqual(data.run.stdout.trim(), 'Hello from C');
    console.log('PASS: POST /execute (C)\n');
}

async function testExecuteCpp() {
    console.log('Testing POST /execute (C++)...');
    const payload = {
        language: 'cpp',
        version: '12.0.0',
        files: [
            {
                content: '#include <iostream>\nint main() { std::cout << "Hello from C++" << std::endl; return 0; }'
            }
        ]
    };

    const res = await fetch(`${API_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();

    console.log('Response:', JSON.stringify(data, null, 2));
    assert.strictEqual(data.run.stdout.trim(), 'Hello from C++');
    console.log('PASS: POST /execute (C++)\n');
}

async function runTests() {
    try {
        await testRuntimes();
        await testExecutePython();
        await testExecuteNode();
        await testExecuteJava();
        await testExecuteC();
        await testExecuteCpp();
        console.log('ALL TESTS PASSED');
    } catch (err) {
        console.error('TEST FAILED:', err);
        process.exit(1);
    }
}

// Wait for server to start roughly
setTimeout(runTests, 2000);
