const {
    Client,
    AccountId,
    PrivateKey,
    AccountCreateTransaction,
    TransferTransaction,
    Hbar,
    AccountBalanceQuery,
    Status
  } = require("@hashgraph/sdk");
const {encryptPrivateKey}=require("./utils/encryption.js");
  
  class HederaService {
    constructor() {
      // Testnet configuration
      this.client = Client.forTestnet();
      this.operatorId = AccountId.fromString("0.0.5767695");
      this.operatorKey = PrivateKey.fromStringED25519("302e020100300506032b657004220420b302745426a96cdd8c15baea174644e48d2896a94182f299e2815012455c7f5d");
      this.client.setOperator(this.operatorId, this.operatorKey);
      this.minBalance = 1; // Minimum HBAR reserve
    }
  
    /**
     * Creates a new Hedera wallet
     * @returns {Promise<{accountId: string, privateKey: string, publicKey: string}>}
     */
    async createWallet(pin) {
      const newKey = PrivateKey.generateED25519();
      
      const tx = await new AccountCreateTransaction()
        .setKey(newKey.publicKey)
        .setInitialBalance(Hbar.from(1)) // Fund with 1 HBAR initially
        .execute(this.client);
  
      const receipt = await tx.getReceipt(this.client);
      const accountId = receipt.accountId.toString();
  
      return {
        accountId,
        privateKey: encryptPrivateKey(newKey.toString(),pin),
      };
    }
  
    /**
     * Sends HBAR between accounts
     * @param {string} senderPrivateKey 
     * @param {string} senderAccountId 
     * @param {string} receiverAccountId 
     * @param {number} amount 
     * @returns {Promise<{status: string, txId: string, hashscanUrl: string}>}
     */
    async sendHBAR(senderPrivateKey, senderAccountId, receiverAccountId, amount) {
      const senderKey = PrivateKey.fromString(senderPrivateKey);
      
      // Verify sufficient balance
      const balance = await this.getBalance(senderAccountId);
      if (balance.hbars < amount + this.minBalance) {
        throw new Error(`Insufficient balance. Available: ${balance.hbars} HBAR`);
      }
  
      const tx = await new TransferTransaction()
        .addHbarTransfer(senderAccountId, Hbar.from(-amount))
        .addHbarTransfer(receiverAccountId, Hbar.from(amount))
        .freezeWith(this.client)
        .sign(senderKey);
  
      const txResponse = await tx.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
  
      return {
        status: receipt.status.toString(),
        txId: txResponse.transactionId.toString(),
        hashscanUrl: `https://hashscan.io/testnet/transaction/${txResponse.transactionId}`,
        newBalance: balance.hbars - amount
      };
    }
  
    /**
     * Gets account balance
     * @param {string} accountId 
     * @returns {Promise<{hbars: number, tinybars: number}>}
     */
    async getBalance(accountId) {
      const balance = await new AccountBalanceQuery()
        .setAccountId(accountId)
        .execute(this.client);
  
      return {
        hbars: balance.hbars.toBigNumber().toNumber(),
        tinybars: balance.hbars.toTinybars().toNumber()
      };
    }
  
    /**
     * Funds a wallet from operator account
     * @param {string} accountId 
     * @param {number} amount 
     */
    async fundWallet(accountId, amount) {
      const tx = await new TransferTransaction()
        .addHbarTransfer(this.operatorId, Hbar.from(-amount))
        .addHbarTransfer(accountId, Hbar.from(amount))
        .execute(this.client);
  
      await tx.getReceipt(this.client);
    }
  
    /**
     * Validates an account exists
     * @param {string} accountId 
     * @returns {Promise<boolean>}
     */
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
