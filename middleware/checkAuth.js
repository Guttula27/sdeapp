// ==========================================
// Authentication Middleware (JWT Verification)
// ==========================================

// 1. Import the 'jsonwebtoken' library.
// We use this library to verify the digital signature of the JSON Web Token (JWT) sent by the client.
const jwt = require('jsonwebtoken');

// 2. Import 'dotenv' and load configuration.
// We need access to 'process.env.JWT_SECRET' to verify the token signature.
require('dotenv').config();

// 3. Define and export the middleware function.
// A middleware function intercepts incoming requests, processes them, and can either return a response
// immediately or hand off control to the next function using the 'next()' callback.
module.exports = (req, res, next) => {
  try {
    // 4. Retrieve the 'Authorization' header from the request headers.
    // HTTP headers are case-insensitive, but Express normalizes them to lowercase.
    const authHeader = req.headers['authorization'];

    // 5. If the header is missing, return a 401 Unauthorized response.
    // This stops the request flow immediately; the controller will not be executed.
    if (!authHeader) {
      return res.status(401).json({ error: 'Access denied. No Authorization header provided.' });
    }

    // 6. Split the authorization header string.
    // Standard authorization headers look like: "Bearer <token_value>".
    // Splitting by space gives us an array: ['Bearer', '<token_value>'].
    const parts = authHeader.split(' ');

    // 7. Verify the split format.
    // It must start with the word 'Bearer' and have the token itself as the second element.
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Access denied. Token format must be "Bearer <token>".' });
    }

    // 8. Extract the actual token string.
    const token = parts[1];

    // 9. Verify the token using the secret key.
    // jwt.verify() will decode the token payload and check if the signature is valid and if the token has expired.
    // If the token is invalid or expired, jwt.verify() will throw an error, jumping to the catch block.
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);

    // 10. Attach the decoded payload (containing user id, email, role, etc.) to the request object.
    // By saving this under 'req.user', all subsequent middleware and controller functions can access the logged-in user.
    req.user = decodedPayload;

    // 11. Call next() to allow the request to proceed to the next middleware or route handler.
    next();
  } catch (err) {
    // 12. Handle verification failures (e.g. token expired, invalid signature).
    // Log the error message for debugging purposes on the server side.
    console.error('Authentication Error:', err.message);

    // 13. Return a 401 Unauthorized response to the client.
    return res.status(401).json({ error: 'Access denied. Invalid or expired token.' });
  }
};
