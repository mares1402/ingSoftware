const express = require('express');
const path = require('path');
const app = express();
const conexion = require('./Back/conexion');
const { registrarUsuario, verificarDuplicados } = require('./Back/singup');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/Font'));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(3000, () => {
    console.log('Servidor escuchando en puerto 3000');
});