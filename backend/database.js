require("dotenv").config();
const { Database } = require("@sqlitecloud/drivers");

const db = new Database(process.env.HPESA_DB);

db.on("error", (err) => {
  console.error("[DB ERROR]:", err);
});

/**
 * Initialize database tables
 * @returns {Promise<void>}
 */
const initDB = () => {
  try {
    db.exec(`
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
        amount REAL NOT NULL,
        txHash TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed')),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (senderPhone) REFERENCES users(phone) ON DELETE SET NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(senderPhone);
      CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiverPhone);
      CREATE INDEX IF NOT EXISTS idx_transactions_txHash ON transactions(txHash);
    `);
    console.log("[DB INFO]: Database initialized successfully");
  } catch (err) {
    console.error("[DB ERROR]: Failed to initialize database:", err);
    throw err;
  }
};

/**
 * Register a new user
 * @param {string} phone
 * @param {string} fullName
 * @param {string} encryptedPrivateKey
 * @param {string} hederaAccountId
 * @param {string} pinHash
 * @returns {Promise<string>} The phone of the created user
 */
const registerUser = async (
  phone,
  fullName,
  encryptedPrivateKey,
  hederaAccountId,
  pinHash,
) => {
  try {
    const result = db.run(
      `INSERT INTO users 
       (phone, fullName, encryptedPrivateKey, hederaAccountId, pinHash) 
       VALUES (?, ?, ?, ?, ?)`,
      [phone, fullName, encryptedPrivateKey, hederaAccountId, pinHash],
    );
    return phone;
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      throw new Error("User already exists");
    }
    throw err;
  }
};

/**
 * Get user by phone number
 * @param {string} phone
 * @returns {Promise<object|null>} User object or null if not found
 */
const getUser = async (phone) => {
  try {
    const user = db.get(
      `SELECT * FROM users WHERE phone = ?`,
      [phone],
    );
    return user || null;
  } catch (err) {
    throw err;
  }
};

/**
 * Update user information
 * @param {string} phone
 * @param {object} updatedFields
 * @returns {Promise<number>} Number of affected rows
 */
const updateUser = async (phone, updatedFields) => {
  const fields = Object.keys(updatedFields);
  const values = Object.values(updatedFields);

  if (fields.length === 0) {
    throw new Error("No fields to update");
  }

  const validFields = [
    "fullName",
    "encryptedPrivateKey",
    "hederaAccountId",
    "pinHash",
    "failedAttempts",
  ];
  const invalidFields = fields.filter((f) => !validFields.includes(f));

  if (invalidFields.length > 0) {
    throw new Error(`Invalid fields: ${invalidFields.join(", ")}`);
  }

  const setClause = fields.map((field) => `${field} = ?`).join(", ");

  try {
    const result = db.run(
      `UPDATE users SET ${setClause} WHERE phone = ?`,
      [...values, phone],
    );
    return result.changes;
  } catch (err) {
    throw err;
  }
};

/**
 * Add a new transaction record
 * @param {string} senderPhone
 * @param {string} receiverPhone
 * @param {number} amount
 * @param {string} txHash
 * @param {string} status
 * @returns {Promise<number>} The ID of the created transaction
 */
const addTransaction = async (
  senderPhone,
  receiverPhone,
  amount,
  txHash,
  status,
) => {
  try {
    const result = db.run(
      `INSERT INTO transactions 
       (senderPhone, receiverPhone, amount, txHash, status)
       VALUES (?, ?, ?, ?, ?)`,
      [senderPhone, receiverPhone, amount, txHash, status],
    );
    return result.lastID;
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      throw new Error("Transaction with this hash already exists");
    }
    if (err.message.includes("FOREIGN KEY constraint failed")) {
      throw new Error("Sender not found in users table");
    }
    throw err;
  }
};

/**
 * Get transactions for a user
 * @param {string} phone
 * @param {number} [limit=10]
 * @returns {Promise<Array>} List of transactions
 */
const getUserTransactions = async (phone, limit = 10) => {
  try {
    return db.all(
      `SELECT * FROM transactions 
       WHERE senderPhone = ? OR receiverPhone = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [phone, phone, limit],
    );
  } catch (err) {
    throw err;
  }
};

module.exports = {
  db,
  initDB,
  addTransaction,
  getUserTransactions,
  getUser,
  registerUser,
  updateUser,
};
