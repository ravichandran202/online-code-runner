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
        "https://namma-coding-shaale.in"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(bodyParser.json());

app.use('/api/v1/ncs', routes);

app.get('/', (req, res) => {
    res.json({ message: 'Welcome To Namma Coding Shaale Code Runner....' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
