const { Client } = require("@hashgraph/sdk");

const hederaClient = Client.forTestnet();
hederaClient.setOperator(
  process.env.HEDERA_OPERATOR_ID,
  process.env.HEDERA_OPERATOR_KEY,
);
