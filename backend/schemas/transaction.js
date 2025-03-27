const joi = require("joi");

const newTransactionSchema = joi.object({
  senderPhone: joi
    .string()
    .regex(/^2547\d{8}$/)
    .required(),
  receiverPhone: joi
    .string()
    .regex(/^2547\d{8}$/)
    .required(),
  amount: joi.number().positive().required(),
  senderPin: joi.string().length(4).required(),
});

module.exports = { newTransactionSchema };
