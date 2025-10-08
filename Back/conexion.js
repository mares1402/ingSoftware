require('dotenv').config();
const mysql = require('mysql2');
pool

// Se cambia createConnection por createPool para manejar las conexiones de forma más robusta.
// El pool previene que las conexiones se cierren por inactividad.
let pool = mysql.createPool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    password: process.env.DB_PASS,
    waitForConnections: true, // Esperar si todas las conexiones están en uso
    connectionLimit: 10,      // Número máximo de conexiones en el pool
    queueLimit: 0             // Sin límite de peticiones en cola
});

console.log("Pool de conexiones creado.");