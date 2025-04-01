const router = require("express").Router();
const {
  getUser,
  addTransaction,
  updateUser,
  getTransactions,
} = require("@services/database");
const hederaService = require("@services/hedera");

const {
  newTransactionSchema,
} = require("@schemas/transaction");
const {
  decryptPrivateKey,
  verifyPinPhone,
} = require("@utils/encryption");
const { verifyToken, requireRole } = require("@middleware/auth");

router.post("/new", verifyToken, requireRole("user"), async (req, res) => {
  try {
    const { error } = newTransactionSchema.validate(req.body);
    if (error) {
      return res.status(400).send({ error: error.details[0].message });
    }
    const sender = await getUser(req.user.phone);
    if (!sender) {
      return res.status(404).send({ error: "Sender not found" });
    }
    if (sender.failedAttempts >= 3) {
      return res.status(403).send({ error: "Sender account locked" });
    }
    if (
      !verifyPinPhone(req.body.pin, sender.phone, sender.pinHash)
    ) {
      await updateUser(sender.phone, {
        failedAttempts: sender.failedAttempts + 1,
      });
      return res.status(403).send({
        error: `Invalid pin: remaining attempts ${3 - (sender.failedAttempts + 1)
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
      req.body.pin,
    );
    const { status, txId, hashScanUrl, newBalance } = await hederaService
      .sendHBAR(
        senderPrivateKey,
        sender.hederaAccountId,
        receiver.hederaAccountId,
        req.body.amount,
      );
    const transactionId = await addTransaction(
      sender.phone,
      req.body.receiverPhone,
      req.body.amount,
      txId,
      status.toLowerCase(),
    );
    if (!transactionId) {
      return res.status(500).send({ error: "Failed to log transaction" });
    }
    return res.status(200).send({
      message: `Transaction successful of id: ${txId}`,
      newBalance,
      hashScanUrl,
    });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

router.get("/all", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const {
      limit = 10,
      offset = 0,
      sortBy = "timestamp",
      sortOrder = "DESC",
    } = req.query;
    const users = await getTransactions(limit, offset, sortBy, sortOrder);
    return res.status(200).send(users);
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});
module.exports = router;
