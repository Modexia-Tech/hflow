const router = require("express").Router();
const {
  getUser,
  registerUser,
  addTransaction,
  updateUser,
  getUserTransactions,
} = require("@services/database");
const hederaService = require("@services/hedera");
const AfricasTalking = require("africastalking");
const { decryptPrivateKey, verifyPinPhone } = require("@utils/encryption");

const africastalking = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: "sandbox",
});
router.post("/", async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = {
    sessionId: "",
    serviceCode: "",
    phoneNumber: "",
    text: "",
    ...req.body,
  };

  const user = await getUser(phoneNumber.replace("+", ""));
  let response = "";
  let msgResult;
  const ussdPassedInput = text.split("*");
  switch (true) {
    case text === "":
      response = `CON Hy from the Hflow team.
What would you like us to help you with today?
1. Create an account
2. My Balance
3. Make a Transaction
4. My Transactions
5. Support`;
      break;
    /* Main Menu Option 1 */
    case text === "1":
      if (user) {
        response = "END You already have an account";
        return res.send(response);
      }
      response = `CON Please Enter your Full Name:`;
      break;

    case text.startsWith("1") && ussdPassedInput.length === 2:
      response = `CON Enter your pin:`;
      break;

    case text.startsWith("1") && ussdPassedInput.length === 3:
      response = `CON Confirm your pin:`;
      break;

    case text.startsWith("1") && ussdPassedInput.length === 4:
      if (user) {
        return res.send("END You already have an account");
      }
      if (ussdPassedInput[2] !== ussdPassedInput[3]) {
        return res.send("END The pins do not match please try again");
      }

      const { accountId, publicKey, encryptedPrivateKey, pinHash } =
        await hederaService.createUserWallet(
          phoneNumber.replace("+", ""),
          ussdPassedInput[3]
        );
      const result = await registerUser(
        phoneNumber.replace("+", ""),
        ussdPassedInput[1],
        encryptedPrivateKey,
        publicKey,
        accountId,
        pinHash
      );
      if (!result) {
        response = "END Failed to create account please try again later";
      }

      msgResult = await africastalking.SMS.send({
        to: phoneNumber,
        message: `Welcome to HFlow your account has been created successfully\nYour account id is ${accountId}`,
        from: "HFlow",
      });
      response = `END successfully created your account of id ${accountId}\nWelcome to HFLOW your number one solution to all your payment needs : )`;
      break;

    case text === "2":
      response = `CON Enter your pin:`;
      break;
    case text.startsWith("2") && ussdPassedInput.length === 2:
      if (!user) {
        return res.status(404).send("END Please create an account first");
      }
      if (!verifyPinPhone(ussdPassedInput[1], user.phone, user.pinHash)) {
        return res.status(403).send("END Invalid pin");
      }
      const balance = await hederaService.getBalance(user.hederaAccountId);

      msgResult = await africastalking.SMS.send({
        to: phoneNumber,
        message: `Your balance is ${balance.hbars} HBAR`,
        from: "HFlow",
      });
      response = `END Your balance is ${balance.hbars} HBAR`;
      break;

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
      if (!user) {
        return res.status(404).send("END Please create an account first");
      }
      if (user.failedAttempts >= 3) {
        return res.status(403).send("END Account locked, contact support");
      }
      if (!verifyPinPhone(ussdPassedInput[3], user.phone, user.pinHash)) {
        await updateUser(user.phone, {
          failedAttempts: user.failedAttempts + 1,
        });
        return res
          .status(403)
          .send(
            `END Invalid pin: remaining attempts ${
              3 - (user.failedAttempts + 1)
            }`
          );
      }

      const receiver = await getUser(ussdPassedInput[1]);
      if (!receiver) {
        return res.status(404).send("END Receiver not found");
      }

      if (user.phone === receiver.phone) {
        return res.status(400).send("END You cannot send money to yourself");
      }

      const senderPrivateKey = decryptPrivateKey(
        user.encryptedPrivateKey,
        ussdPassedInput[3]
      );
      const { status, txId, hashScanUrl, newBalance } =
        await hederaService.sendHBAR(
          senderPrivateKey,
          user.hederaAccountId,
          receiver.hederaAccountId,
          Number(ussdPassedInput[2])
        );

      const transactionId = await addTransaction(
        user.phone,
        receiver.phone,
        Number(ussdPassedInput[2]),
        txId,
        status.toLowerCase()
      );

      msgResult = await africastalking.SMS.send({
        to: phoneNumber,
        message: `${txId}\n confirmed. ${ussdPassedInput[2]} sent to ${receiver.fullName}.\n New balance: ${newBalance.hbars} HBAR`,
        from: "HFlow",
      });
      msgResult = await africastalking.SMS.send({
        to: "+" + receiver.phone,
        message: `${txId} confirmed.\n You have received ${ussdPassedInput[2]} hbar from ${user.fullName}`,
        from: "HFlow",
      });
      response = `END Transaction successful of id: ${txId} new balance: ${newBalance.hbars} HBAR`;
      break;
    case text === "4":
      const transactions = await getUserTransactions(user.phone);
      response = "END You will receive a message of your transactions shortly";
      let transactionsMsg = "";
      transactions.forEach((transaction) => {
        transactionsMsg += `TransactionID: ${transaction.txHash}\nTo: ${transaction.receiverPhone}\nAmount: ${transaction.amount}\timestamp: ${transaction.timestamp}\n\n`;
      });
      msgResult = await africastalking.SMS.send({
        to: phoneNumber,
        message: `Your transactions:\n${transactionsMsg}`,
        from: "HFlow",
      });
      break;
    case text === "5":
      response = "END For support contact us on hflow.onrender.com/contact";
      msgResult = await africastalking.SMS.send({
        to: phoneNumber,
        message: `For support contact us on hflow.onrender.com/contact`,
        from: "HFlow",
      });
      break;

    default:
      response = "END Invalid choice please try again";
  }
  res.send(response);
});

module.exports = router;
