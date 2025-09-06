// db.js
const mysql = require("mysql2");
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Mithran@2004", // your MySQL password
  database: "seaportdb",
});
connection.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL Database.");
});
module.exports = connection;
