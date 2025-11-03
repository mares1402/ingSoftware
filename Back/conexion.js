require('dotenv').config();
const mysql = require('mysql2');

// Se cambia createConnection por createPool para manejar las conexiones de forma más robusta.
// El pool previene que las conexiones se cierren por inactividad.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    password: process.env.DB_PASS,
    waitForConnections: true, 
    connectionLimit: 10,      
    queueLimit: 0             
});

console.log("Pool de conexiones creado.");

module.exports = pool;