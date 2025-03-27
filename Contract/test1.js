const walletManager = require('./wallet_manager');
const hederaService = require('./hedera_service');

async function testFlow() {
  try {
    // 1. Create new wallet
    const pin = "1234"; // In real app, collected from user
    const { accountId, encryptedKey } = await walletManager.createWallet(pin);
    
    console.log("✅ Wallet created:", {
      accountId,
      encryptedKey: encryptedKey.substring(0, 20) + "..."
    });

    // 2. Check balance
    const balance = await hederaService.getBalance(accountId);
    console.log("💰 Balance:", balance.hbars, "HBAR");

    // 3. Send test payment (to yourself)
    const payment = await walletManager.sendPayment(
      encryptedKey,
      pin,
      accountId,
      accountId, // Sending to self for testing
      0.5
    );
    
    console.log("💸 Payment result:", {
      status: payment.status,
      txId: payment.txId,
      hashscanUrl: payment.hashscanUrl
    });

    // 4. Verify new balance
    const newBalance = await hederaService.getBalance(accountId);
    console.log("🔄 New balance:", newBalance.hbars, "HBAR");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testFlow();