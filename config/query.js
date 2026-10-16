// config/query.js
// Promise wrapper around your existing callback-style config/db.js,
// so controllers and middleware can use  await query(sql, params).
const db = require('./db.js');

module.exports = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
