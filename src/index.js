const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 2000;

app.use(bodyParser.json());

app.use('/api/v2', routes);

app.get('/', (req, res) => {
    res.json({ message: 'Piston API Clone is running' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
