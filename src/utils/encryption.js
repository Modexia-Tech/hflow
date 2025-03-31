const CryptoJS = require("crypto-js");

const SECRET_SALT = process.env.ENCRYPTION_SALT || "default-strong-salt";

function encryptPrivateKey(privateKey, pin) {
  const secretKey = `${pin}$${SECRET_SALT}`;

  return CryptoJS.AES.encrypt(privateKey, secretKey).toString();
}

function decryptPrivateKey(encryptedKey, pin) {
  try {
    const secretKey = `${pin}$${SECRET_SALT}`;
    const bytes = CryptoJS.AES.decrypt(encryptedKey, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    throw new Error("Invalid PIN or corrupted key");
  }
}
function hashPinPhone(pin, phone) {
  const salt = CryptoJS.lib.WordArray.random(16).toString();
  const hash = CryptoJS.PBKDF2(`${pin}$${phone}$${SECRET_SALT}`, salt, {
    keySize: 512 / 32,
    iterations: 10000,
  }).toString();

  return `${salt}$${hash}`;
}

function verifyPinPhone(submittedPin, submittedPhone, storedHash) {
  const [salt, originalHash] = storedHash.split("$");
  const newHash = CryptoJS.PBKDF2(
    `${submittedPin}$${submittedPhone}$${SECRET_SALT}`,
    salt,
    { keySize: 512 / 32, iterations: 10000 },
  ).toString();

  return newHash === originalHash;
}

function hashPassword(email, password) {
  const salt = CryptoJS.lib.WordArray.random(16).toString();
  const hash = CryptoJS.PBKDF2(`${password}$${email}$${SECRET_SALT}`, salt, {
    keySize: 512 / 32,
    iterations: 10000,
  }).toString();

  return `${salt}$${hash}`;
}

function verifyPassword(submittedEmail, submittedPassword, storedHash) {
  try {
    // Split the stored hash into salt and original hash
    const [salt, originalHash] = storedHash.split("$");

    // Recreate the hash with the submitted credentials
    const newHash = CryptoJS.PBKDF2(
      `${submittedPassword}$${submittedEmail}$${SECRET_SALT}`,
      salt,
      {
        keySize: 512 / 32,
        iterations: 10000,
      },
    ).toString();

    // Compare the new hash with the stored hash
    return newHash === originalHash;
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}
module.exports = {
  encryptPrivateKey,
  decryptPrivateKey,
  hashPinPhone,
  verifyPinPhone,
  hashPassword,
  verifyPassword,
};
