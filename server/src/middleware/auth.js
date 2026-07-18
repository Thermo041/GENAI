import { verifyToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * JWT auth guard. Accepts the token from the Authorization header
 * ("Bearer <token>") or, for EventSource/SSE requests that cannot set
 * headers, from a `token` query parameter.
 */
export const protect = asyncHandler(async (req, _res, next) => {
  let token = null;

  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    throw ApiError.unauthorized('No token provided');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token expired, please log in again');
    }
    throw ApiError.unauthorized('Invalid token');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('User no longer exists');
  }

  req.user = user;
  next();
});
