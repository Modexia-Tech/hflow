const joi = require("joi");

const newAdminSchema = joi.object({
  fullName: joi.string().required(),
  email: joi.string().email().required(),
  password: joi.string().min(8).required(),
});
