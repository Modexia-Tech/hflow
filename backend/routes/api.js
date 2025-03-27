const router = require("express").Router();
const {
  db,
  registerUser,
  getUser,
  addTransaction,
  updateUser,
} = require("../database");
const hederaService= require("../hederaService");

const { newUserSchema } = require("../schemas/user");
const { newTransactionSchema } = require("../schemas/transaction");
const jwt = require("jsonwebtoken");
const {
  encryptPrivateKey,
  decryptPrivateKey,
  hashPinPhone,
  verifyPinPhone,
} = require("../utils/encryption");
const { } = require("../hederaService.js")
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

    const {
      accountId,
       privateKey
    }= await hederaService.createWallet(req.body.pin);
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
   

    const senderPrivateKey = decryptPrivateKey(sender.encryptedPrivateKey, req.body.senderPin);
    const {status ,txId,hashscanUrl,newBalance} = await hederaService.sendHBAR(
      senderPrivateKey,
      senderHederaAccountId,
      receiverHederaAccountId,
      req.body.amount



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

    if (!verifyPinPhone(req.body.senderPin, req.body.senderPhone, sender.pinHash)) {
      await updateUser(req.body.senderPhone, {
        failedAttempts: sender.failedAttempts + 1,
      });
      return res.status(403).send({
        error: `Invalid pin: remaining attempts ${3 - (sender.failedAttempts + 1)}`,
      });
    }

    // Assuming funding logic involves Hedera service
    const senderPrivateKey = decryptPrivateKey(sender.encryptedPrivateKey, req.body.senderPin);
    const { status, txId, hashscanUrl, newBalance } = await hederaService.fundWallet(
      senderPrivateKey,
      sender.hederaAccountId,
      req.body.amount
    );

    if (status !== "SUCCESS") {
      return res.status(500).send({ error: "Failed to fund wallet" });
    }

    return res.status(200).send({
      message: "Wallet funded successfully",
      transactionId: txId,
      hashscanUrl,
      newBalance,
    });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});
module.exports = router;
