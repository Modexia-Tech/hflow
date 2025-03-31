require("dotenv").config();
const { Database } = require("@sqlitecloud/drivers");

let db;
if (!process.env.HPESA_DB) {
  const sqlite3 = require("sqlite3");
  const path = require("path");
  db = new sqlite3.Database(
    path.resolve(__dirname, "hpesa.db"),
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    (err) => {
      if (err) console.error("[DB ERROR]: Database error:", err);
      else console.log("[DB INFO]: Connected to SQLite database");
    },
  );
} else {
  db = new Database(process.env.HPESA_DB);
}

db.on("error", (error) => {
  console.error("[DB ERROR]: ", error);
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
        publicKey TEXT NOT NULL,
        hederaAccountId TEXT NOT NULL,
        pinHash TEXT NOT NULL,
        failedAttempts INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS admins( 
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email)
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
  publicKey,
  hederaAccountId,
  pinHash,
) => {
  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users 
         (phone, fullName, encryptedPrivateKey,publicKey, hederaAccountId, pinHash) 
         VALUES (?, ?, ?,?, ?, ?)`,
        [
          phone,
          fullName,
          encryptedPrivateKey,
          publicKey,
          hederaAccountId,
          pinHash,
        ],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
              reject(new Error("User already exists"));
            } else {
              reject(err);
            }
          } else {
            resolve(this); // 'this' contains lastID and changes
          }
        },
      );
    });
    return result;
  } catch (err) {
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
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM users WHERE phone = ?`,
        [phone],
        (err, row) => {
          if (err) reject(err);
          resolve(row || null);
        },
      );
    });
    return user;
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
    "publicKey",
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
    const result = db.run(`UPDATE users SET ${setClause} WHERE phone = ?`, [
      ...values,
      phone,
    ]);
    return result.changes;
  } catch (err) {
    throw err;
  }
};
/**
 * Get users
 * @param {string} phone
 * @param {number} [limit=10]
 * @param {string} [sortBy='createdAt'] - Field to sort by (phone, fullName, createdAt)
 * @param {string} [sortOrder='DESC'] - Sort order (ASC or DESC)
 * @returns {Promise<Array>} List of users
 */
const getUsers = async (
  limit = 10,
  offset = 0,
  sortBy = "createdAt",
  sortOrder = "DESC",
) => {
  try {
    const validSortFields = [
      "phone",
      "fullName",
      "createdAt",
      "hederaAccountId",
    ];
    const validSortOrders = ["ASC", "DESC"];

    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder
      : "DESC";
    return await new Promise((resolve, reject) => {
      return db.all(
        `
        SELECT phone, fullName, publicKey, hederaAccountId, createdAt 
        FROM users 
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) {
            reject(new Error("Failed to get users"));
          }
          resolve(rows);
        },
      );
    });
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

const getTransactions = async (
  limit = 10,
  offset = 0,
  sortBy = "timestamp",
  sortOrder = "DESC",
) => {
  try {
    const validSortFields = [
      "timestamp",
      "status",
      "amount",
    ];
    const validSortOrders = ["ASC", "DESC"];

    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "timestamp";
    const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder
      : "DESC";
    return await new Promise((resolve, reject) => {
      return db.all(
        `
        SELECT id,senderPhone, receiverPhone, amount, txHash, status, timestamp
        FROM transactions
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) {
            reject(new Error("Failed to get transactions"));
          }
          resolve(rows);
        },
      );
    });
  } catch (err) {
    throw err;
  }
};

const registerAdmin = async (fullName, email, passwordHash) => {
  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO admins 
         (fullName, email, password)
         VALUES (?, ?, ?)`,
        [fullName, email, passwordHash],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
              reject(new Error("Admin with this email already exists"));
            } else {
              reject(err);
            }
          } else {
            resolve(this);
          }
        },
      );
    });
    return result;
  } catch (err) {
    throw err;
  }
};

const getAdmin = async (email) => {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM admins WHERE email = ?`,
        [email],
        (err, row) => {
          if (err) reject(err);
          resolve(row || null);
        },
      );
    });
    return user;
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
  getUsers,
  getAdmin,
  registerAdmin,
  getTransactions,
};
