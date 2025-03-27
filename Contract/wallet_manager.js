const crypto = require('crypto');
const hederaService = require('./hedera_service');

class WalletManager {
  /**
   * Creates new wallet with encrypted private key
   * @param {string} pin - 4-digit PIN
   * 
   * @returns {Promise<{accountId: string, encryptedKey: string}>} 
   */
  async createWallet(pin) {
    const wallet = await hederaService.createWallet();
    
    return {
      accountId: wallet.accountId,
      encryptedKey: this.encryptKey(wallet.privateKey, pin)
    };
  }

  /**
   * Sends payment after PIN verification
   * @param {string} encryptedKey 
   * @param {string} pin 
   * @param {string} senderAccountId 
   * @param {string} receiverAccountId 
   * @param {number} amount 
   */
  async sendPayment(encryptedKey, pin, senderAccountId, receiverAccountId, amount) {
    const privateKey = this.decryptKey(encryptedKey, pin);
    return hederaService.sendHBAR(privateKey, senderAccountId, receiverAccountId, amount);
  }

  /**
   * Encrypts private key with PIN
   * @param {string} privateKey 
   * @param {string} pin 
   */
  encryptKey(privateKey, pin) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      crypto.scryptSync(pin, 'salt', 32), 
      iv
    );
    return Buffer.concat([
      iv, 
      cipher.update(privateKey), 
      cipher.final()
    ]).toString('hex');
  }

  /**
   * Decrypts private key with PIN
   * @param {string} encryptedKey 
   * @param {string} pin 
   */
  decryptKey(encryptedKey, pin) {
    const data = Buffer.from(encryptedKey, 'hex');
    const iv = data.subarray(0, 16);
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      crypto.scryptSync(pin, 'salt', 32), 
      iv
    );
    return Buffer.concat([
      decipher.update(data.subarray(16)), 
      decipher.final()
    ]).toString();
  }
}

module.exports = new WalletManager();