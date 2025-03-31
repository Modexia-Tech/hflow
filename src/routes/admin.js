const router = require("express").Router();
const {
  getUser,
} = require("@services/database");
const hederaService = require("@services/hedera");

const {
  fundWalletSchema,
} = require("@schemas/transaction");

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
});

module.exports = router;
