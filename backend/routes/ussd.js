const router = require("express").Router();
const { getUser, registerUser, addTransaction, updateUser } = require(
  "../database",
);
const hederaService = require("../hederaService");

const {
  encryptPrivateKey,
  decryptPrivateKey,
  hashPinPhone,
  verifyPinPhone,
} = require("../utils/encryption");

router.post("/", async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = {
    sessionId: "",
    serviceCode: "",
    phoneNumber: "",
    text: "",
    ...req.body,
  };

  const user = await getUser(phoneNumber);
  let response = "";
  const ussdPassedInput = text.split("*");
  switch (true) {
    case text === "":
      response = `CON Hy from the Hpesa team.
What would you like us to help you with today?
1. Create an account
2. My Balance
3. Make a Transaction
4. My Transactions
5. Support`;
      break;
    /* Main Menu Option 1 */
    case text === "1":
      response = `CON Please Enter your Full Name:`;
      break;

    case text.startsWith("1") && ussdPassedInput.length === 2:
      response = `CON Enter your pin:`;
      break;

    case text.startsWith("1") && ussdPassedInput.length === 3:
      response = `CON Confirm your pin:`;
      break;

    case text.startsWith("1") && ussdPassedInput.length === 4:
      if (ussdPassedInput[2] !== ussdPassedInput[3]) {
        return res.send("END The pins do not match please try again");
      }

      const { accountId, privateKey } = await hederaService.createUserWallet(
        ussdPassedInput[2],
      );
      const pinHash = hashPinPhone(ussdPassedInput[2], phoneNumber);

      const id = await registerUser(
        phoneNumber.replace("+", ""),
        ussdPassedInput[1],
        privateKey,
        accountId,
        pinHash,
      );
      response =
        `END successfully created your account of id ${id}\nWelcome to HPESA your number one solution to all your payment needs : )`;
      break;

    /* Main Menu Option 3 */
    case text === "2":
      response = `CON Enter your pin:`;
      break;
    case text.startsWith("2") && ussdPassedInput.length === 2:
      const user = await getUser(phoneNumber.replace("+", ""));
      if (!user) {
        return res.status(404).send("END Please create an account first");
      }
      const balance = await hederaService.getBalance(user.hederaAccountId);
      response = `END Your balance is ${balance.hbars} HBAR`;
      break;

    /* Main Menu Option 3 */
    case text === "3":
      response = `CON Enter receivers phone number:`;
      break;
    case text.startsWith("3") && ussdPassedInput.length === 2:
      response = `CON Enter amount to send:`;
      break;
    case text.startsWith("3") && ussdPassedInput.length === 3:
      response = "CON Enter your pin:";
      break;
    case text.startsWith("3") && ussdPassedInput.length === 4:
      const sender = await getUser(phoneNumber.replace("+", ""));
      if (!sender) {
        return res.status(404).send("END Please create an account first");
      }
      if (sender.failedAttempts >= 3) {
        return res.status(403).send("END Account locked, contact support");
      }
      if (
        !verifyPinPhone(
          ussdPassedInput[3],
          sender.phone,
          sender.pinHash,
        )
      ) {
        await updateUser(sender.phone, {
          failedAttempts: sender.failedAttempts + 1,
        });
        return res.status(403).send(
          `END Invalid pin: remaining attempts ${3 - (sender.failedAttempts + 1)
          }`,
        );
      }

      const receiver = await getUser(ussdPassedInput[1]);
      if (!receiver) {
        return res.status(404).send("END Receiver not found");
      }

      if (sender.phone === receiver.phone) {
        return res.status(400).send("END You cannot send money to yourself");
      }

      const senderPrivateKey = decryptPrivateKey(
        sender.encryptedPrivateKey,
        ussdPassedInput[3],
      );
      const { status, txId, hashscanUrl, newBalance } = await hederaService
        .sendHBAR(
          senderPrivateKey,
          sender.hederaAccountId,
          receiver.hederaAccountId,
          Number(ussdPassedInput[2]),
        );

      const transactionId = await addTransaction(
        req.body.senderPhone,
        req.body.receiverPhone,
        req.body.amount,
        txId,
        status.toLowerCase(),
      );
      response =
        `END Transaction successful of id: ${txId} new balance: ${newBalance} HBAR`;
      break;
    default:
      response = "END Invalid choice please try again";
  }
  res.send(response);
});

module.exports = router;
