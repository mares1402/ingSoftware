const conexion = require('./conexion');
const bcrypt = require('bcrypt');

// Verifica si el email o teléfono ya están registrados
function verificarDuplicados(email, telefono, callback) {
    const query = 'SELECT email, telefono FROM usuarios WHERE email = ? OR telefono = ?';
    conexion.query(query, [email, telefono], (err, results) => {
        if (err) return callback(err);

        let duplicado = { email: false, telefono: false };
        results.forEach(row => {
            if (row.email === email) duplicado.email = true;
            if (row.telefono === telefono) duplicado.telefono = true;
        });

        callback(null, duplicado);
    });
}


// Registra al usuario con contraseña cifrada
function registrarUsuario({ name, apellido_paterno, apellido_materno, email, password, telefono }, callback) {
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return callback(err);
        const query = 'INSERT INTO usuarios (nombre, apellidoP, apellidoM, email, password, telefono) VALUES (?, ?, ?, ?, ?, ?)';
        conexion.query(query, [name, apellido_paterno, apellido_materno, email, hash, telefono], callback);
    });
}

module.exports = { registrarUsuario, verificarDuplicados };