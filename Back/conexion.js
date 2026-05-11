require('dotenv').config();
const mysql = require('mysql2');

// El pool previene que las conexiones se cierren por inactividad.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    password: process.env.DB_PASS,
    waitForConnections: true,
    connectionLimit: 50, // Ajustado al límite del servidor de BD
    queueLimit: 0
});

console.log("Pool de conexiones creado.");

module.exports = pool;