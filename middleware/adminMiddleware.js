const formatResponse = require('../utils/responseFormatter'); // Import response formatter

const adminMiddleware = (req, res, next) => {
    // Check if the user is an admin
    if (req.user.role !== 'admin') {
        return res.status(403).json(formatResponse(false, { message: 'Access denied: Admins only' }));
    }
    next(); // If admin, proceed to the next middleware or route handler
};

module.exports = adminMiddleware;
