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

const registerAdmin = async (fullName, email, password) => {
  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO admins 
         (fullName,email,password)
         VALUES (?, ?, ?)`,
        [
          fullName,
          email,
          password,
        ],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
              reject(new Error("Admin already exists"));
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

// Interactive admin setup
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePassword = (password) => {
  return password.length >= 8;
};

const hashPassword = async (password) => {
  // In a real application, you would use bcrypt or similar
  // For this example, we'll just return a mock hash
  return Promise.resolve(`hashed_${password}`);
};

const setupAdmin = async () => {
  try {
    console.log("\n=== Admin Account Setup ===");

    const fullName = await prompt("Enter your full name: ");
    if (!fullName) {
      throw new Error("Full name is required");
    }

    let email;
    while (true) {
      email = await prompt("Enter your email: ");
      if (!validateEmail(email)) {
        console.log("Invalid email format. Please try again.");
      } else {
        break;
      }
    }

    let password, confirmPassword;
    while (true) {
      password = await prompt("Enter your password (min 8 characters): ");
      if (!validatePassword(password)) {
        console.log("Password must be at least 8 characters long.");
        continue;
      }

      confirmPassword = await prompt("Confirm your password: ");
      if (password !== confirmPassword) {
        console.log("Passwords do not match. Please try again.");
      } else {
        break;
      }
    }

    const passwordHash = await hashPassword(password);

    console.log("\nCreating admin account...");
    await registerAdmin(fullName, email, passwordHash);
    console.log("Admin account created successfully!");
  } catch (error) {
    console.error("Error during admin setup:", error.message);
  } finally {
    rl.close();
    db.close();
  }
};

// Check if we need to setup admin
const checkAdminSetup = async () => {
  try {
    const row = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM admins", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (row.count === 0) {
      console.log("No admin account found. Starting setup...");
      await setupAdmin();
    } else {
      console.log("Admin account already exists. Skipping setup.");
      db.close();
    }
  } catch (error) {
    console.error("Error checking admin setup:", error);
    db.close();
  }
};

// main
initDB();
checkAdminSetup();
