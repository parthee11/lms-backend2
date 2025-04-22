const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const formatResponse = require('../utils/responseFormatter'); // Import response formatter
const router = express.Router();

// Register a new student user
router.post('/register', async (req, res) => {
    const { username, email, password, profile, rank, lms_score, batches } = req.body;

    try {
        // Check if a user with the same email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(formatResponse(false, { message: 'Email already in use' }));
        }

        // Check if the username is taken
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(400).json(formatResponse(false, { message: 'Username already in use' }));
        }

        // Hash the password and create a new student user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            profile, // Profile object with all the user details
            rank: rank || 0, // Optional rank, default to 0 if not provided
            lms_score: lms_score || 0, // Optional LMS score, default to 0
            batches: batches || [], // Optional batches array
            role: 'student', // Role is 'student' by default
        });

        await newUser.save();
        res.status(201).json(formatResponse(true, { message: 'Student registered successfully' }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Register a new admin user
router.post('/register-admin', async (req, res) => {
    const { username, email, password, profile, rank, lms_score, batches, admin_password } = req.body;

    try {
        // Check if the admin password is correct
        if (admin_password !== 'makemeadmin') {
            return res.status(403).json(formatResponse(false, { message: 'Invalid admin password' }));
        }

        // Check if the email or username already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(formatResponse(false, { message: 'Email already in use' }));
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(400).json(formatResponse(false, { message: 'Username already in use' }));
        }

        // Hash the password and create a new admin user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdminUser = new User({
            username,
            email,
            password: hashedPassword,
            profile, // Profile object with all the user details
            rank: rank || 0, // Optional rank, default to 0
            lms_score: lms_score || 0, // Optional LMS score, default to 0
            batches: batches || [], // Optional batches array
            role: 'admin', // Set role as 'admin'
        });

        await newAdminUser.save();
        res.status(201).json(formatResponse(true, { message: 'Admin registered successfully' }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Login user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        // If user doesn't exist or password is incorrect
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json(formatResponse(false, { message: 'Invalid credentials' }));
        }

        // Create a JWT token with the user's id and role
        const token = jwt.sign(
            { id: user._id, role: user.role }, // Include role in the payload
            process.env.JWT_SECRET
        );
        
        res.json(formatResponse(true, { token }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

module.exports = router;
