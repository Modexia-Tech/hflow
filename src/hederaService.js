const {
  Client,
  AccountId,
  PrivateKey,
  AccountCreateTransaction,
  TransferTransaction,
  Hbar,
  AccountBalanceQuery,
  Status,
} = require("@hashgraph/sdk");
const {
  encryptPrivateKey,
  decryptPrivateKey,
  hashPinPhone,
  verifyPinPhone,
} = require("./utils/encryption");
const { hbarToKes, kesToHbar } = require("./utils/currency");
require("dotenv").config();

class HederaService {
  constructor() {
    this.client = Client.forTestnet();
    this.client.setOperator(
      AccountId.fromString(process.env.HEDERA_OPERATOR_ID),
      PrivateKey.fromStringED25519(
        process.env.HEDERA_OPERATOR_PRIVATE_KEY,
      ),
    );
    this.minBalance = 1;
    this.maxAttempts = 3;
  }

  /**
   * Complete wallet creation with PIN security
   * @param {string} phone - User phone number
   * @param {string} pin - 4-digit PIN
   * @returns {Promise<{accountId: string, encryptedKey: string, pinHash: string}>}
   */
  async createUserWallet(phone, pin) {
    const newKey = PrivateKey.generateED25519();

    // Fund account with 1 HBAR
    const tx = await new AccountCreateTransaction()
      .setKey(newKey.publicKey)
      .setInitialBalance(Hbar.from(1))
      .execute(this.client);

    const receipt = await tx.getReceipt(this.client);
    const accountId = receipt.accountId.toString();

    return {
      accountId,
      encryptedKey: encryptPrivateKey(newKey.toString(), pin),
      pinHash: hashPinPhone(pin, phone),
    };
  }

  /**
   * Secure transaction processing with PIN verification
   * @param {object} sender - {phone, encryptedKey, pinHash, accountId}
   * @param {string} receiverAccountId
   * @param {number} amountHBAR
   * @param {string} inputPin
   * @returns {Promise<{status: string, txId: string, newBalance: number}>}
   */
  async processTransaction(sender, receiverAccountId, amountHBAR, inputPin) {
    // 1. PIN verification
    if (!verifyPinPhone(inputPin, sender.phone, sender.pinHash)) {
      throw new Error("Invalid PIN");
    }

    // 2. Decrypt private key
    const privateKey = decryptPrivateKey(sender.encryptedKey, inputPin);

    // 3. Execute transfer
    return this.sendHBAR(
      privateKey,
      sender.accountId,
      receiverAccountId,
      amountHBAR,
    );
  }

  /**
   * Currency-converted funding
   * @param {string} accountId
   * @param {number} amountKES
   * @returns {Promise<{status: string, amountHBAR: number}>}
   */
  async fundWalletWithKES(accountId, amountKES) {
    const amountHBAR = await kesToHbar(amountKES);
    await this.fundWallet(accountId, amountHBAR);
    return {
      status: "success",
      amountHBAR: parseFloat(amountHBAR.toFixed(8)),
    };
  }

  /**
   * Get balance with currency conversion
   * @param {string} accountId
   * @returns {Promise<{hbars: number, kesEquivalent: number}>}
   */
  async getBalanceWithKES(accountId) {
    const balance = await this.getBalance(accountId);
    const kesEquivalent = await hbarToKes(balance.hbars);
    return {
      hbars: balance.hbars,
      kesEquivalent: parseFloat(kesEquivalent.toFixed(2)),
    };
  }

  async accountExists(accountId) {
    try {
      await this.getBalance(accountId);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new HederaService();

