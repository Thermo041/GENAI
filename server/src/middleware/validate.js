import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

/**
 * Runs express-validator chains and throws a 400 with the first
 * validation message if any rule failed.
 */
export const validate = (validations) => async (req, _res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(ApiError.badRequest(errors.array()[0].msg));
  }
  next();
};
