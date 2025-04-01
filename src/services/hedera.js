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
} = require("../utils/encryption");
const { hbarToKes, kesToHbar } = require("../utils/currency");
require("dotenv").config();

class HederaService {
  constructor() {
    if (
      !process.env.HEDERA_OPERATOR_ID ||
      !process.env.HEDERA_OPERATOR_PRIVATE_KEY
    ) {
      throw new Error(
        "Hedera operator ID and private key must be set in environment variables.",
      );
    }

    this.client = process.env.HEDERA_NETWORK === "mainnet"
      ? Client.forMainnet()
      : Client.forTestnet();
    this.client.setOperator(
      AccountId.fromString(process.env.HEDERA_OPERATOR_ID),
      PrivateKey.fromStringED25519(process.env.HEDERA_OPERATOR_PRIVATE_KEY),
    );
    this.minBalance = 1;
    this.maxAttempts = 3;
    this.client.setMaxAttempts(5);
    // this.client.setMaxNodeWaitTime(15000);
  }

  /**
   * Optimized wallet creation with enhanced security and performance
   * @param {string} phone - User phone number (for PIN hashing)
   * @param {string} pin - 4-6 digit PIN
   * @returns {Promise<{accountId: string, encryptedKey: string, pinHash: string, publicKey: string}>}
   */
  async createUserWallet(phone, pin) {
    // 1. Input Validation
    if (!phone || !pin) {
      throw new Error("Invalid phone or PIN format");
    }

    // 2. Parallelize key generation and initial balance check
    // const [newKey, operatorBalance] = await Promise.all([
    //   PrivateKey.generateED25519(),
    // this.getBalance(this.client.operatorAccountId.toString()),
    // ]);
    const newKey = await PrivateKey.generateED25519Async();

    // 3. Validate operator has sufficient funds
    // if (operatorBalance.hbars < this.minBalance * 1.5) {
    //   // 50% buffer
    //   throw new Error("Insufficient operator funds for account creation");
    // }

    let txId;
    try {
      // 4. Optimized account creation (single network call)
      const response = await new AccountCreateTransaction()
        .setKey(newKey.publicKey)
        .setInitialBalance(Hbar.from(this.minBalance))
        .setTransactionMemo(`Hflow wallet creation for ${phone}`)
        .execute(this.client);

      txId = response.transactionId;
      const receipt = await response.getReceipt(this.client);

      if (receipt.status !== Status.Success || !receipt.accountId) {
        throw new Error(`Account creation failed: ${receipt.status}`);
      }

      // 5. Parallelize crypto operations
      const [encryptedPrivateKey, pinHash] = await Promise.all([
        encryptPrivateKey(newKey.toString(), pin),
        hashPinPhone(pin, phone),
      ]);

      return {
        accountId: receipt.accountId.toString(),
        publicKey: newKey.publicKey.toString(),
        encryptedPrivateKey,
        pinHash,
      };
    } catch (error) {
      // 6. Enhanced error handling with cleanup
      if (txId) {
        await this.cancelPendingTransaction(txId).catch(console.error);
      }
      // newKey._keyData.fill(0); // Securely wipe key from memory
      throw new Error(`Wallet creation failed: ${error.message}`);
    } finally {
      // newKey._keyData.fill(0); // Double-cleanup
    }
  }

  // Helper method for transaction cleanup
  async cancelPendingTransaction(transactionId) {
    if (!transactionId) return;

    try {
      await new TransactionReceiptQuery()
        .setTransactionId(transactionId)
        .setMaxAttempts(1)
        .execute(this.client);
    } catch {
      // Transaction not found - already processed or expired
    }
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
    return await this.sendHBAR(
      privateKey,
      sender.accountId,
      receiverAccountId,
      amountHBAR,
    );
  }
  // Add these missing methods to the class:

  async sendHBAR(privateKeyStr, senderId, receiverId, amountHBAR) {
    const privateKey = PrivateKey.fromStringED25519(privateKeyStr);
    const senderAccountId = AccountId.fromString(senderId);
    const receiverAccountId = AccountId.fromString(receiverId);

    const tx = await new TransferTransaction()
      .addHbarTransfer(senderAccountId, Hbar.from(-amountHBAR))
      .addHbarTransfer(receiverAccountId, Hbar.from(amountHBAR))
      .setTransactionMemo(`Hflow transfer to ${receiverId}`)
      .freezeWith(this.client)
      .sign(privateKey);

    const txId = await tx.execute(this.client);
    const receipt = await txId.getReceipt(this.client);

    if (receipt.status !== Status.Success) {
      throw new Error(`Transaction failed: ${receipt.status}`);
    }

    return {
      status: "success",
      txId: txId.transactionId.toString(),
      hashScanUrl:
        `https://explorer.kabuto.sh/testnet/transaction/${txId.transactionId}`,
      newBalance: await this.getBalance(senderId),
    };
  }

  async getBalance(accountId) {
    const query = new AccountBalanceQuery().setAccountId(accountId);

    const balance = await query.execute(this.client);
    return {
      hbars: balance.hbars.toBigNumber().toNumber(),
    };
  }

  async fundWallet(accountId, amountHBAR) {
    const receiverAccountId = AccountId.fromString(accountId);
    const tx = await new TransferTransaction()
      .addHbarTransfer(this.client.operatorAccountId, Hbar.from(-amountHBAR))
      .addHbarTransfer(receiverAccountId, Hbar.from(amountHBAR))
      .execute(this.client);

    const receipt = await tx.getReceipt(this.client);
    if (receipt.status !== Status.Success) {
      throw new Error(`Funding failed: ${receipt.status}`);
    }
    return {
      txId: tx.transactionId.toString(),
    };
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
  async executeWithRetry(transaction, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await transaction.execute(this.client);
      } catch (err) {
        if (i === attempts - 1) throw err;
        await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
      }
    }
  }
  validateAccountId(id) {
    if (!id || !id.toString().match(/^\d+\.\d+\.\d+$/)) {
      throw new Error("Invalid Hedera account ID format");
    }
  }
}

module.exports = new HederaService();
