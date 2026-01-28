# Code Runner

A high-performance code execution engine . This service allows you to execute code in various languages securely within isolated environments.

## Features

- **Multi-Language Support**: Python, JavaScript, Go, Java, C, C++, and SQL (SQLite).
- **Execution Controls**: Support for `run_timeout`, `compile_timeout`, stdin, and arguments.
- **Separate Compilation Stage**: Distinct results for compilation and execution stages for compiled languages.
- **Containerized**: Runs securely using Docker.

## Prerequisites

- **Node.js**: v18+
- **Docker**: Required for isolated execution (or local tools if running without Docker).

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd code-runner
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the server:**
    ```bash
    npm start
    ```
    The server will start on port `2000` by default.

## API Documentation

**Base URL**: `/api/v1/ncs`

### 1. Execute Code
Runs the provided code in the specified language.

-   **Endpoint**: `POST /execute`
-   **Content-Type**: `application/json`

**Request Body Parameters:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `language` | string | Yes | The language to use (e.g., `python`, `cpp`). |
| `version` | string | Yes | The version of the language (e.g., `3.10.0`). |
| `files` | array | Yes | Array of file objects `{ "name": "...", "content": "..." }`. |
| `stdin` | string | No | Input to pass to the program's stdin. |
| `args` | array | No | Command line arguments for the program. |
| `run_timeout` | number | No | Run stage timeout in milliseconds (default: 3000). |
| `compile_timeout` | number | No | Compile stage timeout in milliseconds (default: 10000). |

**Example Request:**
```json
{
  "language": "cpp",
  "version": "12.0.0",
  "files": [
    {
      "name": "main.cpp",
      "content": "#include <iostream>\nint main() { std::cout << \"Hello World\"; return 0; }"
    }
  ],
  "compile_timeout": 5000,
  "run_timeout": 2000
}
```

**Example Response:**
```json
{
  "language": "cpp",
  "version": "12.0.0",
  "run": {
    "stdout": "Hello World",
    "stderr": "",
    "output": "Hello World",
    "code": 0,
    "signal": null
  },
  "compile": {
    "stdout": "",
    "stderr": "",
    "output": "",
    "code": 0,
    "signal": null
  }
}
```

### 2. Get Runtimes
Returns a list of available languages and versions.

-   **Endpoint**: `GET /runtimes`

**Response:**
```json
[
  {
    "language": "python",
    "version": "3.10.0",
    "aliases": ["py", "python3"],
    "runtime": "python3"
  },
  ...
]
```

### 3. Packages API
Stub implementation for managing packages (install/uninstall simulation).

#### List Packages
Returns a list of all supported packages and their installation status.

-   **Endpoint**: `GET /packages`

**Response:**
```json
[
  {
    "language": "python",
    "language_version": "3.10.0",
    "installed": true
  },
  ...
]
```

#### Install Package
Installs the specified package (Stub).

-   **Endpoint**: `POST /packages`
-   **Content-Type**: `application/json`

**Request Body:**
```json
{
  "language": "bash",
  "version": "5.1.0"
}
```

**Response:**
```json
{
  "language": "bash",
  "version": "5.1.0"
}
```

#### Uninstall Package
Uninstalls the specified package (Stub).

-   **Endpoint**: `DELETE /packages`
-   **Content-Type**: `application/json`

**Request Body:**
```json
{
  "language": "bash",
  "version": "5.1.0"
}
```

**Response:**
```json
{
  "language": "bash",
  "version": "5.1.0"
}
```

## Supported Languages

| Language | Version | Aliases |
| :--- | :--- | :--- |
| Python | 3.10.0 | py, python3 |
| JavaScript | 18.15.0 | js, node |
| Go | 1.19.0 | golang |
| Java | 17.0.0 | openjdk |
| C | 12.0.0 | gcc |
| C++ | 12.0.0 | c++, g++ |
| SQL | 3.36.0 | sqlite, sqlite3 |

## Architecture

The Code Runner operates as a lightweight, secure code execution service.

1.  **API Layer (Express.js)**: Receives HTTP requests, validates input, and routes them to the executor.
2.  **Executor Service**: Manages the lifecycle of a code execution job.
    -   **Isolation**: Creates a temporary directory for each job.
    -   **Compilation**: For compiled languages (Go, Java, C++), it runs a build step first.
    -   **Execution**: Spawns a child process (or Docker container in production) to run the code.
3.  **Process Management**: logical handling of `stdin`, `stdout`, `stderr`, and `signals` (e.g., timeouts).

## Advanced Usage

### Multi-File Execution
You can execute projects with multiple files. The `files` array allows you to specify the content of each file.

**Example: Go Multi-File Project**
```bash
curl -X POST http://localhost:2000/api/v1/ncs/execute \
-H "Content-Type: application/json" \
-d '{
  "language": "go",
  "version": "1.19.0",
  "files": [
    {
      "name": "main.go",
      "content": "package main\nimport \"fmt\"\nfunc main() { fmt.Println(GetMessage()) }"
    },
    {
      "name": "helper.go",
      "content": "package main\nfunc GetMessage() string { return \"Hello from multi-file Go!\" }"
    }
  ]
}'
```

### Understanding Signals & Timeouts
The `signal` field in the response indicates if the process was terminated forcibly.

-   **`null`**: The process finished normally.
-   **`SIGTERM`**: The process was killed, usually because it exceeded the `run_timeout`.
-   **`SIGSEGV`**: Segmentation fault (typically memory access violation in C/C++).

**Example: Handling Timeouts**
If you set `"run_timeout": 2000` (2s) and your code sleeps for 5s, the response will look like:
```json
{
  "run": {
    "stdout": "...",
    "signal": "SIGTERM",
    "result": "..."
  }
}
```

## Testing

Run the compliance test script to verify all features:

```bash
node test_ncs_compliance.js
```
