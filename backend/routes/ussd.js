const router = require("express").Router();
const { getUser, registerUser } = require("../database");

const {
  encryptPrivateKey,
  decryptPrivateKey,
  hashPinPhone,
  verifyPinPhone,
} = require("../utils/encryption");
router.post("/", async (req, res) => {
  const sessionId = req.body.sessionId;
  const serviceCode = req.body.serviceCode;
  const phoneNumber = req.body.phoneNumber;
  let text = req.body.text || "default";

  const user = await getUser(phoneNumber);
  let response = "";
  const ussdPassedInput = text.split("*");
  if (text == "") {
    response = `CON Hy from the Hpesa team.
What would you like us to help you with today? ${phoneNumber}

1. Create an account
2. My Account
3. My phone number
4. Transactions
5. Support`;
  } else if (text == "1") {
    response = `CON Please Enter your Full Name:
    `;
  } else if (text.startsWith("1") && ussdPassedInput.length == 2) {
    response = `CON Enter your pin:
    `;
  } else if (text.startsWith("1") && ussdPassedInput.length == 3) {
    response = `CON Confirm your pin:
    `;
  } else if (text.startsWith("1") && ussdPassedInput.length == 4) {
    if (ussdPassedInput[1] !== ussdPassedInput[2]) {
      return res.send("END The pins do not match please try again");
    }

    // daniels magic goes here
    const key = "dummy key";
    const hederaAccountId = "id";
    const encryptedKey = encryptPrivateKey(key, ussdPassedInput[2]);
    const pinHash = hashPinPhone(ussdPassedInput[2], phoneNumber);

    const id = await registerUser(
      phoneNumber,
      ussdPassedInput[1],
      encryptedKey,
      hederaAccountId,
      pinHash,
    );
    response =
      `END successfully created your account of id ${id}\nWelcome to HPESA your number one solution to all your payment needs : )`;
  } else {
    response = "END Invalid choice please try again";
  }
  res.send(response);
});

module.exports = router;
