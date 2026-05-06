import * as Joi from 'joi';

export const validationSchema = Joi.object({
  FIREBASE_PROJECT_ID: Joi.string().required(),
  FIREBASE_CLIENT_EMAIL: Joi.string().required(),
  FIREBASE_PRIVATE_KEY: Joi.string().required(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  POSTGRES_URL: Joi.string().uri().required(),
}).unknown(true);
