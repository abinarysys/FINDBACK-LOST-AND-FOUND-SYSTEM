
require('dotenv').config();
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const sslEnabled =
    process.env.DB_HOST && process.env.DB_SSL === 'true';

let ssl;

if (sslEnabled) {
    if (!process.env.DB_SSL_CA) {
        throw new Error('DB_SSL_CA is missing from .env');
    }

    const caPath = path.resolve(process.cwd(), process.env.DB_SSL_CA);

    ssl = {
        ca: fs.readFileSync(caPath, 'utf8'),
        rejectUnauthorized: true
    };
}

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'findback_demo',

    waitForConnections: true,
    connectionLimit: 10,

    ...(ssl ? { ssl } : {})
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
