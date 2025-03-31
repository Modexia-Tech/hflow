const router = require("express").Router();
const jwt = require("jsonwebtoken");

const { verifyPinPhone } = require("@utils/encryption");
const { verifyToken, requireRole } = require("@middleware/auth");

const {
  registerUser,
  getUser,
} = require("@services/database");
const hederaService = require("@services/hedera");

const { newUserSchema, userActionSchema } = require("@schemas/user");

router.post("/new", async (req, res) => {
  try {
    const { error } = newUserSchema.validate(req.body);
    if (error) {
      return res.status(400).send({ error: error.details[0].message });
    }
    if (await getUser(req.body.phone)) {
      return res.status(400).send({ error: "User already exists" });
    }
    const { accountId, publicKey, encryptedPrivateKey, pinHash } =
      await hederaService.createUserWallet(req.body.phone, req.body.pin);
    const result = await registerUser(
      req.body.phone,
      req.body.fullName,
      encryptedPrivateKey,
      publicKey,
      accountId,
      pinHash,
    );
    if (!result) {
      res.status(500).send({ error: "Failed to create user" });
    }
    res
      .status(201)
      .send({ accountId, publicKey });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).send({ error: "Phone and PIN are required" });
    }

    const user = await getUser(phone);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    if (!verifyPinPhone(pin, phone, user.pinHash)) {
      return res.status(401).send({ error: "Invalid PIN" });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        phone: user.phone,
        hederaAccountId: user.hederaAccountId,
        role: "user",
      },
      process.env.SECRET_KEY,
      { expiresIn: "24h" }, // Token expires in 24 hours
    );

    // Return success response with token
    res.status(200).send({
      message: "Login successful",
      token,
      user: {
        phone: user.phone,
        fullName: user.fullName,
        hederaAccountId: user.hederaAccountId,
        publicKey: user.publicKey,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send({ error: "Internal server error" });
  }
});

router.get("/accountInfo", verifyToken, async (req, res) => {
  try {
    const user = await getUser(req.user.phone);

    const balance = await hederaService.getBalance(user.hederaAccountId);

    return res.status(200).send(balance);
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

module.exports = router;
