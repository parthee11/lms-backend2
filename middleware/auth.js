const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Ensure you import the User model
const formatResponse = require('../utils/responseFormatter'); // Import response formatter

const authMiddleware = async (req, res, next) => {
    // Get the token from the Authorization header
    const authHeader = req.headers['authorization'];

    // Check if the Authorization header exists
    if (!authHeader) {
        return res.status(403).json(formatResponse(false, { message: 'No token provided' }));
    }

    // The token is usually prefixed with "Bearer", we need to split it
    const token = authHeader.split(' ')[1]; // Split by space and get the second part (the actual token)

    if (!token) {
        return res.status(403).json(formatResponse(false, { message: 'Invalid token format' }));
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch the user by ID and include their role
        const user = await User.findById(decoded.id).select('username email profile role'); // Select necessary fields

        // If user is not found, respond with an error
        if (!user) {
            return res.status(404).json(formatResponse(false, { message: 'User not found' }));
        }

        // Attach user data to request
        req.userId = user._id;
        req.user = user; // Attach user object to request for further access

        next(); // Proceed to the next middleware or route handler
    } catch (err) {
        // Handle errors (token verification errors or DB errors)
        return res.status(401).json(formatResponse(false, { message: 'Unauthorized' }));
    }
};

module.exports = authMiddleware;
