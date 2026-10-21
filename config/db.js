
require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'findback_db',

    waitForConnections: true,
    connectionLimit: 10,

    ...(process.env.DB_HOST && process.env.DB_SSL === 'true'
        ? { ssl: { rejectUnauthorized: true } }
        : {})
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }

    console.log('Connected to FindBack MySQL database!');
    connection.release();
});

module.exports = db;
