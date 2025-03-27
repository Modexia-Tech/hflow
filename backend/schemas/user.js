const Joi = require("joi");

const newUserSchema = Joi.object({
  phone: Joi.string()
    .regex(/^254\d{9}$/)
    .required(),
  fullName: Joi.string().required(),
  pin: Joi.string().length(4).required(),
});

const updateUserSchema = Joi.object({
  phone: Joi.string().regex(/^2547\d{8}$/),
  fullName: Joi.string(),
  pin: Joi.string().length(4),
  failedAttempts: Joi.number(),
});

const userTransactionSchema = Joi.object({
  phone: Joi.string()
    .regex(/^2547\d{8}$/)
    .required(),
  pin: Joi.string().length(4).required(),
});
module.exports = { newUserSchema, userTransactionSchema };
