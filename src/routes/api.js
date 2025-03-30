const router = require("express").Router();
const {
  registerUser,
  getUser,
  addTransaction,
  updateUser,
} = require("@services/database");
const hederaService = require("@services/hedera");

const { newUserSchema, userActionSchema } = require("@schemas/user");
const {
  newTransactionSchema,
  fundWalletSchema,
} = require("@schemas/transaction");
const {
  encryptPrivateKey,
  decryptPrivateKey,
  hashPinPhone,
  verifyPinPhone,
} = require("@utils/encryption");

router.post("/registerUser", async (req, res) => {
  try {
    const { error } = newUserSchema.validate(req.body);
    if (error) {
      return res.status(400).send({ error: error.details[0].message });
    }

    const { accountId, privateKey } = await hederaService.createUserWallet(
      req.body.pin
    );
    const pinHash = hashPinPhone(req.body.pin, req.body.phone);

    const id = await registerUser(
      req.body.phone,
      req.body.fullName,
      privateKey,
      accountId,
      pinHash
    );
    res.status(201).send(`successfully created user of id: ${id}`);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

router.post("/userAccountBalance", async (req, res) => {
  try {
    const { error } = userActionSchema.validate(req.body);

    if (error) {
      return res.status(400).send({ error: error.details[0].message });
    }
    const user = await getUser(req.body.phone);

    const balance = await hederaService.getBalance(user.hederaAccountId);

    return res.status(200).send(balance);
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

router.post("/makeTransaction", async (req, res) => {
  try {
    const { error } = newTransactionSchema.validate(req.body);
    if (error) {
      return res.status(400).send({ error: error.details[0].message });
    }
    const sender = await getUser(req.body.senderPhone);
    if (!sender) {
      return res.status(404).send({ error: "Sender not found" });
    }
    if (sender.failedAttempts >= 3) {
      return res.status(403).send({ error: "Sender account locked" });
    }
    if (
      !verifyPinPhone(req.body.senderPin, req.body.senderPhone, sender.pinHash)
    ) {
      await updateUser(req.body.senderPhone, {
        failedAttempts: sender.failedAttempts + 1,
      });
      return res.status(403).send({
        error: `Invalid pin: remaining attempts ${
          3 - (sender.failedAttempts + 1)
        }`,
      });
    }

    const receiver = await getUser(req.body.receiverPhone);
    if (!receiver) {
      return res.status(404).send({ error: "Receiver not found" });
    }

    if (sender.phone === receiver.phone) {
      return res.status(400).send({ error: "Cannot send to self" });
    }

    const senderPrivateKey = decryptPrivateKey(
      sender.encryptedPrivateKey,
      req.body.senderPin
    );
    const { status, txId, hashscanUrl, newBalance } =
      await hederaService.sendHBAR(
        senderPrivateKey,
        sender.hederaAccountId,
        receiver.hederaAccountId,
        req.body.amount
      );
    const transactionId = await addTransaction(
      req.body.senderPhone,
      req.body.receiverPhone,
      req.body.amount,
      txId,
      status.toLowerCase()
    );
    if (!transactionId) {
      return res.status(500).send({ error: "Failed to log transaction" });
    }
    return res.status(200).send({
      message: `Transaction successful of id: ${txId}`,
      newBalance,
      hashscanUrl,
    });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

router.post("/fundWallet", async (req, res) => {
  try {
    // 1. Validate request
    const { error } = fundWalletSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const receiver = await getUser(req.body.receiverPhone);
    if (!receiver) {
      return res.status(404).json({ error: "Account not found" });
    }

    const result = await hederaService.fundWallet(
      receiver.hederaAccountId,
      req.body.amount
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("FundWallet Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Unable to process wallet funding",
    });
  }
});

module.exports = router;
