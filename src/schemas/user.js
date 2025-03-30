const joi = require("joi");

const newUserSchema = joi.object({
  phone: joi.string()
    .regex(/^254\d{9}$/)
    .required(),
  fullName: joi.string().required(),
  pin: joi.string().length(4).required(),
});

const updateUserSchema = joi.object({
  phone: joi.string().regex(/^254\d{9}$/),
  fullName: joi.string(),
  pin: joi.string().length(4),
  failedAttempts: joi.number(),
});

const userActionSchema = joi.object({
  phone: joi.string()
    .regex(/^254\d{9}$/)
    .required(),
  pin: joi.string().length(4).required(),
});
module.exports = { newUserSchema, userActionSchema, updateUserSchema };
