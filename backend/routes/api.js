const router = require("express").Router();
const {
  registerUser,
  getUser,
  addTransaction,
  updateUser,
} = require("../database");
const hederaService = require("../hederaService");

const { newUserSchema, userActionSchema } = require("../schemas/user");
const { newTransactionSchema, fundWalletSchema } = require(
  "../schemas/transaction",
);
const {
  encryptPrivateKey,
  decryptPrivateKey,
  hashPinPhone,
  verifyPinPhone,
} = require("../utils/encryption");

router.post("/registerUser", async (req, res) => {
  try {
    const { error } = newUserSchema.validate(req.body);
    if (error) {
      return res.status(400).send({ error: error.details[0].message });
    }

    const {
      accountId,
      privateKey,
    } = await hederaService.createWallet(req.body.pin);
    const pinHash = hashPinPhone(req.body.pin, req.body.phone);

    const id = await registerUser(
      req.body.phone,
      req.body.fullName,
      privateKey,
      accountId,
      pinHash,
    );
    res.status(201).send(`successfully created user of id: ${id}`);
  } catch (err) {
    res.status(400).send({ error: err.message });
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
    // allow transaction only if the pin is correct
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

    // get balance from hedera (daniels magic goes here)
    // const balance = await hederaService.getBalance(sender.hederaAccountId);

    // For the sake of this example, let's assume the balance is 100 HBAR\
    const senderBalance = 100;
    if (senderBalance < req.body.amount) {
      return res
        .status(400)
        .send({ error: `Insufficient balance of sh${senderBalance}` });
    }

    // hedera transaction goes here
    const senderHederaAccountId = sender.hederaAccountId;
    const receiverHederaAccountId = receiver.hederaAccountId;
    const senderPrivateKey = decryptPrivateKey(
      sender.encryptedPrivateKey,
      req.body.senderPin,
    );
    // deduct from sender
    // add to receiver

    // update transaction history

    const transactionId = await addTransaction(
      req.body.senderPhone,
      req.body.receiverPhone,
      req.body.amount,
      txId,
      status,
    );
    if (!transactionId) {
      return res.status(500).send({ error: "Failed to log transaction" });
    }
    return res
      .status(200)
      .send({ message: `Transaction successful of id: ${transactionId}` });
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

    // 3. Get sender and verify account status
    const sender = await getUser(req.body.receiverPhone);
    if (!sender) {
      return res.status(404).json({ error: "Account not found" });
    }

    const amountInTinybars = Math.round(req.body.amount * 1e8); // Convert to whole tinybars

    const result = await hederaService
      .fundWallet(
        sender.hederaAccountId,
        amountInTinybars,
      );

    return res.status(200).json(`The result is ${result}`);
  } catch (error) {
    console.error("FundWallet Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Unable to process wallet funding",
    });
  }
});

module.exports = router;
