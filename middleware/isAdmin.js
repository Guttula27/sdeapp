// ==========================================
// Authorization Middleware (Admin Role Verification)
// ==========================================

// 1. Define and export the middleware function.
// This middleware acts as a role check. It expects 'req.user' to have been populated
// by the preceding 'checkAuth.js' middleware.
module.exports = (req, res, next) => {
  // 2. Safety check: Verify that 'req.user' exists.
  // If 'req.user' is undefined, it means 'checkAuth' was not executed before this middleware.
  // We return a 500 Internal Server Error because this is a developer setup/configuration error.
  if (!req.user) {
    return res.status(500).json({ 
      error: 'Authorization error. User data is missing. Make sure checkAuth middleware is placed before isAdmin.' 
    });
  }

  // 3. Inspect the 'role' property attached to 'req.user'.
  // If the role is NOT 'admin', we deny access by returning a 403 Forbidden response.
  // 403 Forbidden means the server understands who the user is (authenticated), but the user does not have permission to access the resource.
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. This action requires administrator privileges.' 
    });
  }

  // 4. If the user's role is 'admin', everything is valid.
  // We call next() to pass execution to the next function (e.g., the delete book controller).
  next();
};
