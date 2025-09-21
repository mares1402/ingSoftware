const express = require('express');
const path = require('path');
const app = express();
const conexion = require('./Back/conexion');
const authRoutes = require('./Back/aut-controller');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/Font'));
app.use(express.static(__dirname));

app.use('/', authRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(3000, () => {
    console.log('Servidor escuchando en puerto 3000');
    console.log('http://localhost:3000');
});

