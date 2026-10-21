// Turns MySQL's callback-based query into a Promise so handlers can use await.
const db = require("./db.js");

// Pass placeholder values separately from SQL, and let callers handle failures with try/catch.
module.exports = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
