const router = require("express").Router();
const {
  getUser,
  getAdmin,
  registerAdmin,
} = require("@services/database");
const { verifyToken, requireRole } = require("@middleware/auth");
const hederaService = require("@services/hedera");
const {verifyPassword}=require("@utils/encryption")
const jwt = require("jsonwebtoken");

const { fundWalletSchema, newAdminSchema } = require("@schemas/transaction");

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send({ error: "Email and password are required" });
    }

    const admin = await getAdmin(email);
    if (!admin) {
      return res.status(404).send({ error: "Admin not found" });
    }

    console.log(email,password)
    if (!verifyPassword(email, password, admin.password)) {
      return res.status(401).send({ error: "Invalid password" });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        email,
        role: "admin",
      },
      process.env.SECRET_KEY,
      { expiresIn: "24h" }, // Token expires in 24 hours
    );

    // Return success response with token
    res.status(200).send({
      message: "Login successful",
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send({ error: "Internal server error" });
  }
});

router.post(
  "/fundWallet",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
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
        req.body.amount,
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error("FundWallet Error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: "Unable to process wallet funding",
      });
    }
  },
);

router.post("/getBalance", async (req, res) => { });

router.post("/new", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { error } = newAdminSchema.validate(req.body);
    if (error) {
      return res.status(400).send({ error: error.details[0].message });
    }
    const result = registerAdmin(
      req.body.fullName,
      req.body.email,
      req.body.password,
    );
    if (!result) {
      res.status(500).send({ error: "Failed to create admin" });
    }
    res
      .status(201)
      .send({ email: req.body.email, message: "Admin created successfully" });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

module.exports = router;
