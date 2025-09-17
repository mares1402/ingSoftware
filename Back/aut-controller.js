const express = require('express');
const bcrypt = require('bcryptjs');
const conexion = require('./conexion');
const router = express.Router();

// Registro
router.post('/signup', async (req, res) => {
    const { name, apellido_paterno, apellido_materno, email, password, Genero, telefono } = req.body;
    console.log("Cuerpo recibido:", req.body);
    if (!name || !apellido_paterno || !apellido_materno || !email || !password || !Genero || !telefono) {
        return res.status(400).send("Todos los campos son obligatorios");
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO Usuario (nombre, paterno, materno, correo, password, genero, telefono)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        conexion.query(sql, [name, apellido_paterno, apellido_materno, email, hashedPassword, Genero, telefono], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).send("El correo ya está registrado");
                }
                console.error("Error al registrar:", err);
                return res.status(500).send("Error en el servidor");
            }
            res.status(200).send("Usuario registrado correctamente");
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al encriptar la contraseña");
    }
});

// Login
router.post('/login', (req, res) => {
    const { usuario, password } = req.body;

    const sql = `SELECT * FROM Usuario WHERE correo = ?`;
    conexion.query(sql, [usuario], async (err, results) => {
        if (err) return res.status(500).json({ mensaje: "Error en el servidor" });

        if (results.length === 0) {
            // Usuario no existe
            return res.status(404).json({ mensaje: "El usuario no está registrado", caso: 1 });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            // Contraseña incorrecta
            return res.status(401).json({ mensaje: "Contraseña incorrecta", caso: 2 });
        }

        // Login exitoso
        res.status(200).json({
            mensaje: "Login exitoso",
            user: {
                id: user.id_usuario,
                nombre: user.nombre,
                correo: user.correo,
                tipo_usuario: user.tipo_usuario
            }
        });
    });
});

module.exports = router;