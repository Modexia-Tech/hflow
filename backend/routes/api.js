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

import { Router } from 'express';
import Joi from 'joi';

const router = Router();

// Validation Schema
const fundWalletSchema = Joi.object({
  senderPhone: Joi.string().required(),
  senderPin: Joi.string().required(),
  amount: Joi.number().positive().precision(8).required(), // Allows up to 8 decimal places
});

// Helper Functions
const validateAmount = (amount) => {
  const tinybars = amount * 1e8; // Convert HBAR to tinybars
  return Number.isInteger(tinybars);
};

// Route Handler
router.post('/fundWallet', async (req, res) => {
  try {
    // 1. Validate request
    const { error } = fundWalletSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.details.map(d => d.message) 
      });
    }

    // 2. Validate amount precision
    if (!validateAmount(req.body.amount)) {
      return res.status(400).json({
        error: 'Invalid amount precision',
        message: 'Amount must be convertible to whole tinybars (max 8 decimal places)'
      });
    }

    // 3. Get sender and verify account status
    const sender = await getUser(req.body.senderPhone);
    if (!sender) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (sender.failedAttempts >= 3) {
      return res.status(403).json({ 
        error: 'Account temporarily locked',
        message: 'Too many failed attempts. Please contact support.' 
      });
    }

    // 4. Verify PIN
    if (!verifyPinPhone(req.body.senderPin, req.body.senderPhone, sender.pinHash)) {
      await updateUser(req.body.senderPhone, { 
        failedAttempts: sender.failedAttempts + 1 
      });
      return res.status(403).json({
        error: 'Authentication failed',
        remainingAttempts: 2 - sender.failedAttempts
      });
    }

    // 5. Reset failed attempts on successful auth
    await updateUser(req.body.senderPhone, { failedAttempts: 0 });

    // 6. Process transaction
    const senderPrivateKey = decryptPrivateKey(sender.encryptedPrivateKey, req.body.senderPin);
    const amountInTinybars = Math.round(req.body.amount * 1e8); // Convert to whole tinybars

    const { status, txId, hashscanUrl, newBalance } = await hederaService.fundWallet(
      senderPrivateKey,
      sender.hederaAccountId,
      amountInTinybars
    );

    if (status !== 'SUCCESS') {
      return res.status(502).json({ 
        error: 'Transaction failed',
        message: 'Network error occurred while processing transaction' 
      });
    }

    // 7. Return success response
    return res.status(200).json({
      status: 'success',
      transactionId: txId,
      hashscanUrl,
      newBalance: newBalance / 1e8, // Convert back to HBAR
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FundWallet Error:', error);

    // Handle specific Hedera errors
    if (error.message.includes('tinybars contains decimals')) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Transaction amount must be in whole tinybars'
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to process wallet funding'
    });
  }
});

export default router;
module.exports = router;
