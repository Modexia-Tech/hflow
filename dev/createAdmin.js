require("dotenv").config();
const { db, initDB, registerAdmin } = require("../src/services/database");
const { hashPassword } = require("../src/utils/encryption");

// Interactive setup
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (question, hide = false) => {
  return new Promise((resolve) => {
    if (hide) {
      // Backup original write method
      const originalWrite = process.stdout.write;

      // Override to mask input
      process.stdout.write = (string) => {
        if (string.match(/[\r\n]/)) {
          return originalWrite.call(process.stdout, string);
        }
        return originalWrite.call(process.stdout, "*".repeat(string.length));
      };

      rl.question(question, (answer) => {
        // Restore original write method
        process.stdout.write = originalWrite;
        resolve(answer.trim());
      });
    } else {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    }
  });
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePassword = (password) => {
  return password.length >= 8;
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
      password = await prompt(
        "Enter your password (min 8 characters): ",
        false,
      );
      if (!validatePassword(password)) {
        console.log("\nPassword must be at least 8 characters long.");
        continue;
      }

      confirmPassword = await prompt("Confirm your password: ", false);
      if (password !== confirmPassword) {
        console.log("\nPasswords do not match. Please try again.");
      } else {
        break;
      }
    }

    console.log("\nCreating admin account...");
    await registerAdmin(fullName, email, hashPassword(email, password));
    console.log("✅ Admin account created successfully!");
  } catch (error) {
    console.error("\n❌ Error during admin setup:", error.message);
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
