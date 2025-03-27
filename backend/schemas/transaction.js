const joi = require("joi");

const newTransactionSchema = joi.object({
  senderPhone: joi
    .string()
    .regex(/^254\d{9}$/)
    .required(),
  receiverPhone: joi
    .string()
    .regex(/^254\d{9}$/)
    .required(),
  amount: joi.number().positive().required(),
  senderPin: joi.string().length(4).required(),
  
});

module.exports = { newTransactionSchema };
