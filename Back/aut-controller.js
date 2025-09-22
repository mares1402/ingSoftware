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
    if (err) {
      console.error(err);
      return res.status(500).json({ mensaje: 'Error en el servidor' });
    }
    if (results.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no registrado', caso: 1 });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta', caso: 2 });
    }

    // Construir objeto de sesión (NO incluir datos sensibles)
    const sessionUser = {
      id_usuario: user.id_usuario,
      nombre: user.nombre,
      paterno: user.paterno,
      materno: user.materno,
      correo: user.correo,
      genero: user.genero,
      telefono: user.telefono,
      tipo_usuario: Number(user.tipo_usuario) // 1 o 2
    };

    // Guardar en sesión
    req.session.user = sessionUser;

    // Responder (opcional) con info
    res.json({ mensaje: 'Login exitoso', user: sessionUser });
  });
});

module.exports = router;