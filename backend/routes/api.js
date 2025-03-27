const router = require("express").Router();
const {
  db,
  registerUser,
  getUser,
  addTransaction,
  updateUser,
} = require("../database");

const { newUserSchema } = require("../schemas/user");
const { newTransactionSchema } = require("../schemas/transaction");
const jwt = require("jsonwebtoken");
const {
  encryptPrivateKey,
  decryptPrivateKey,
  hashPinPhone,
  verifyPinPhone,
} = require("../utils/encryption");
const SECRET_KEY = process.env.SECRET_KEY;

const verifyToken = (req, res, next) => {
  if (req.headers && req.headers.authorization) {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.sendStatus(403);
    jwt.verify(token, SECRET_KEY, (err, authData) => {
      try {
        if (err) return res.status(403).json({ err: err });

        // confirm if user exists
        const user = db.get(
          `SELECT * FROM users WHERE phone = ?`,
          [authData.phone],
          (err, row) => {
            if (err) return null;
            else return row;
          }
        );
        if (!user) return res.sendStatus(403);

        req.phone = authData.phone;
        next();
      } catch (error) {
        return res.status(500).json({ err: error.message });
      }
    });
  } else {
    return res.sendStatus(403);
  }
};

router.post("/registerUser", async (req, res) => {
  try {
    const { error } = newUserSchema.validate(req.body);
    if (error) {
      return res.status(400).send({ error: error.details[0].message });
    }
    // TODO: DANIEL make sure napata hizi vitu hivi lol
    // hedera user creation will happen here expect to be returned private key and account id

    // Step 1: Generate unique private key
    //  const privateKey = PrivateKey.generate(); // 🔑 Unique per user
    //  const publicKey = privateKey.publicKey;

    // Step 2: Create Hedera account
    //  const tx = await new AccountCreateTransaction()
    //    .setKey(publicKey)
    //    .setInitialBalance(new Hbar(10)) // Fund with 10 HBAR (testnet)
    //    .execute(hederaClient);

    //  const accountId = (await tx.getReceipt(hederaClient)).accountId;

    const key = "dummy key";
    const hederaAccountId = "id";
    const encryptedKey = encryptPrivateKey(key, req.body.pin);
    const pinHash = hashPinPhone(req.body.pin, req.body.phone);

    const id = await registerUser(
      req.body.phone,
      req.body.fullName,
      encryptedKey,
      hederaAccountId,
      pinHash
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
      req.body.senderPin
    );
    // deduct from sender
    // add to receiver

    // update transaction history

    const txHash = "dummy hash";
    const transactionId = await addTransaction(
      req.body.senderPhone,
      req.body.receiverPhone,
      req.body.amount,
      txHash,
      "success"
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
module.exports = router;
