const joi = require("joi");

const newTransactionSchema = joi.object({
  receiverPhone: joi
    .string()
    .regex(/^254\d{9}$/)
    .required(),
  amount: joi.number().positive().required(),
  pin: joi.string().length(4).required(),
});

const fundWalletSchema = joi.object({
  receiverPhone: joi.string().required(),
  amount: joi.number().positive().precision(8).required(),
});
module.exports = { newTransactionSchema, fundWalletSchema };
