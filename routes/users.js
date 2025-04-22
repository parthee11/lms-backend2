const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/adminMiddleware'); // Admin middleware
const formatResponse = require('../utils/responseFormatter'); // Response formatter
const router = express.Router();

// Get user data (for authenticated user)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password'); // Exclude password
        if (!user) {
            return res.status(404).json(formatResponse(false, { message: 'User not found' }));
        }
        res.json(formatResponse(true, user));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Update user profile (for authenticated user)
router.put('/me', authMiddleware, async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(req.userId, req.body, { new: true }).select('-password');
        res.json(formatResponse(true, updatedUser));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Admin: Fetch all students with pagination
router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const students = await User.find({ role: 'student' })
            .select('username email profile rank lms_score role')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalStudents = await User.countDocuments({ role: 'student' });

        res.json(formatResponse(true, {
            students,
            totalPages: Math.ceil(totalStudents / limit),
            currentPage: page,
        }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Admin: Add a new user
router.post('/add', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { username, email, password, role, profile } = req.body;

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user object with the hashed password
        const newUser = new User({
            username,
            email,
            password: hashedPassword, // Save the hashed password
            role,
            profile
        });

        // Save the new user to the database
        await newUser.save();

        res.status(201).json(formatResponse(true, { message: 'User created successfully', newUser }));
    } catch (error) {
        if (error.code === 11000) { // Handle duplicate email error
            return res.status(400).json(formatResponse(false, { message: 'Email already exists' }));
        }
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Admin: Delete a user
router.delete('/delete/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json(formatResponse(false, { message: 'User not found' }));
        }
        res.json(formatResponse(true, { message: 'User deleted successfully' }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Admin: Modify a user
router.put('/update/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
        if (!updatedUser) {
            return res.status(404).json(formatResponse(false, { message: 'User not found' }));
        }
        res.json(formatResponse(true, { message: 'User updated successfully', updatedUser }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Admin: Fuzzy search users by name
router.get('/search', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name = '', page = 1, limit = 10 } = req.query;

        if (!name.trim()) {
            return res.status(400).json(formatResponse(false, { message: 'Name query parameter is required' }));
        }

        // Perform fuzzy search using regex
        const regex = new RegExp(name, 'i'); // 'i' for case-insensitive search

        const users = await User.find({ 'profile.name': regex })
            .select('username email profile rank lms_score role') // Adjust as needed
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalUsers = await User.countDocuments({ 'profile.name': regex });

        res.json(formatResponse(true, {
            users,
            totalPages: Math.ceil(totalUsers / limit),
            currentPage: page,
        }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

module.exports = router;
