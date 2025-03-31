const router = require("express").Router();

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

router.post("/accountInfo", async (req, res) => {
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

module.exports = router;
