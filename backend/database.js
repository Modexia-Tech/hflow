const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(
  path.resolve(__dirname, "hpesa.db"),
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) console.error("[ERROR]: Database error:", err);
    else console.log("[INFO]: Connected to SQLite database");
  }
);

const initDB = () => {
  db.exec(
    `
    CREATE TABLE IF NOT EXISTS users (
      phone TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      encryptedPrivateKey TEXT NOT NULL,
      hederaAccountId TEXT NOT NULL,
      pinHash TEXT NOT NULL,
      failedAttempts INTEGER DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderPhone TEXT,
      receiverPhone TEXT,
      amount REAL,
      txHash TEXT,
      status TEXT CHECK(status IN ('pending', 'success', 'failed')),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (senderPhone) REFERENCES users(phone)
    );
  `,
    function (err) {
      if (err) {
        console.log("[ERROR]: Failed to initialized db: ", err);
      } else {
        console.log("[INFO]: Initialized db successfully");
      }
    }
  );
};

// Insert user (registration)
const registerUser = (
  phone,
  fullName,
  encryptedPrivateKey,
  hederaAccountId,
  pinHash
) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (phone,fullName, encryptedPrivateKey, hederaAccountId,pinHash) 
       VALUES (?,?, ?, ?,?)`,
      [phone, fullName, encryptedPrivateKey, hederaAccountId, pinHash],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

// Get user by phone
const getUser = (phone) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE phone = ?`, [phone], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Update user by phone
const updateUser = (phone, updatedFields) => {
  const fields = Object.keys(updatedFields);
  const values = Object.values(updatedFields);

  if (fields.length === 0) {
    return Promise.reject(new Error("No fields to update"));
  }

  const setClause = fields.map((field) => `${field} = ?`).join(", ");

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE users SET ${setClause} WHERE phone = ?`,
      [...values, phone],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

// Log transaction
const addTransaction = (senderPhone, receiverPhone, amount, txHash, status) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO transactions 
       (senderPhone, receiverPhone, amount, txHash, status)
       VALUES (?, ?, ?, ?, ?)`,
      [senderPhone, receiverPhone, amount, txHash, status],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};
module.exports = {
  db,
  initDB,
  addTransaction,
  getUser,
  registerUser,
  updateUser,
};
