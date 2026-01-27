const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');

const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 2000;

app.use(cors({
    origin: [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:2000",
        "https://namma-coding-shaale.onrender.com"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(bodyParser.json());

app.use('/api/v2', routes);

app.get('/', (req, res) => {
    res.json({ message: 'Piston API Clone is running' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
