const express = require('express');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Test = require('../models/Test'); // Import the Test model
const authMiddleware = require('../middleware/auth'); // Existing auth middleware
const adminMiddleware = require('../middleware/adminMiddleware'); // New admin middleware
const formatResponse = require('../utils/responseFormatter'); // Import response formatter
const router = express.Router();

// Create a new batch (admin access only)
router.post('/create', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const newBatch = new Batch({
            ...req.body,
            admin_id: req.userId // Assign the admin ID from the authenticated user
        });
        await newBatch.save();
        res.status(201).json(formatResponse(true, newBatch)); // Use your response formatter
    } catch (error) {
        if (error.code === 11000) { // Handle MongoDB duplicate key error
            return res.status(400).json(formatResponse(false, { message: 'Batch name must be unique' }));
        }
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Delete a batch (admin access only)
router.delete('/delete/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const batch = await Batch.findByIdAndDelete(req.params.id); // Find and delete the batch

        if (!batch) {
            return res.status(404).json(formatResponse(false, { message: 'Batch not found' }));
        }

        res.status(200).json(formatResponse(true, { message: 'Batch deleted successfully' })); // Success response
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' })); // Error response
    }
});

// Get all batches (admin access only)
router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const batches = await Batch.find();
        res.json(batches);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all students in a batch by batch ID (admin access only)
router.get('/students/:batchId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { batchId } = req.params; // Get batch ID from URL parameters

        // Find the batch by ID and populate the students
        const batch = await Batch.findById(batchId).populate('students');
        if (!batch) {
            return res.status(404).json(formatResponse(false, { message: 'Batch not found' }));
        }

        // Respond with the list of students in the batch
        res.json(formatResponse(true, {
            message: 'Students fetched successfully',
            students: batch.students
        }));
    } catch (error) {
        console.error(error);
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Get all tests in a batch by batch ID (admin access only)
router.get('/tests/:batchId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { batchId } = req.params; // Get batch ID from URL parameters

        // Find the batch by ID and populate the tests
        const batch = await Batch.findById(batchId).populate('tests');
        if (!batch) {
            return res.status(404).json(formatResponse(false, { message: 'Batch not found' }));
        }

        // Respond with the list of tests in the batch
        res.json(formatResponse(true, {
            message: 'Tests fetched successfully',
            tests: batch.tests
        }));
    } catch (error) {
        console.error(error);
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Enroll multiple students in a batch (admin access only)
router.put('/enroll/:batchId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { userIds } = req.body; // Array of User IDs passed in the request body
        const { batchId } = req.params; // Batch ID from URL params

        // Check if userIds is an array
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json(formatResponse(false, { message: 'Invalid userIds array' }));
        }

        // Find the batch by ID
        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json(formatResponse(false, { message: 'Batch not found' }));
        }

        // Process each user ID
        const enrolledUsers = []; // Store enrolled users
        const alreadyEnrolledUsers = []; // Store users already enrolled in the batch
        const notFoundUsers = []; // Store users not found

        for (const userId of userIds) {
            // Check if the user exists
            const user = await User.findById(userId);
            if (!user) {
                notFoundUsers.push(userId);
                continue;
            }

            // Check if the user is already enrolled in the batch
            if (batch.students.includes(userId)) {
                alreadyEnrolledUsers.push(userId);
                continue;
            }

            // Add user to the batch
            batch.students.push(userId);
            enrolledUsers.push(user);

            // Check if the batch is already in the user's batches array
            if (!user.batches.includes(batchId)) {
                user.batches.push(batchId);
                await user.save(); // Save the updated user document
            }
        }

        // Save the updated batch document
        await batch.save();

        // Prepare response data
        const responseData = {
            message: 'Users enrolled in batch successfully',
            enrolledUsers,
            alreadyEnrolledUsers,
            notFoundUsers,
            batch
        };

        res.json(formatResponse(true, responseData));
    } catch (error) {
        console.error(error);
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});


// Remove a student from a batch (admin access only)
router.put('/remove/:batchId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.body; // User ID passed in request body
        const { batchId } = req.params; // Batch ID from URL params

        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json(formatResponse(false, { message: 'User not found' }));
        }

        // Find the batch by ID
        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json(formatResponse(false, { message: 'Batch not found' }));
        }

        // Check if the user is enrolled in the batch
        const studentIndex = batch.students.indexOf(userId);
        if (studentIndex === -1) {
            return res.status(404).json(formatResponse(false, { message: 'Student not found in batch' }));
        }

        // Remove the user from the batch's students array
        batch.students.splice(studentIndex, 1);
        await batch.save();

        // Remove the batch from the user's batches array
        user.batches = user.batches.filter(batchId => batchId.toString() !== batchId);
        await user.save();

        // Respond with the updated batch
        res.json(formatResponse(true, {
            message: 'Student removed from batch successfully',
            batch,
            user
        }));
    } catch (error) {
        console.error(error);
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Add or update multiple tests in the batch (admin access only)
router.put('/add-tests/:batchId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { testIds } = req.body; // Array of Test IDs passed in the request body
        const { batchId } = req.params; // Batch ID from URL params

        // Check if testIds is an array
        if (!Array.isArray(testIds) || testIds.length === 0) {
            return res.status(400).json(formatResponse(false, { message: 'Invalid testIds array' }));
        }

        // Find the batch by ID
        const batch = await Batch.findById(batchId).populate('tests');
        if (!batch) {
            return res.status(404).json(formatResponse(false, { message: 'Batch not found' }));
        }

        // Process each test ID
        const addedTests = []; // Store added tests
        const alreadyAddedTests = []; // Store tests already added to the batch
        const notFoundTests = []; // Store tests not found

        for (const testId of testIds) {
            // Check if the test exists
            const test = await Test.findById(testId);
            if (!test) {
                notFoundTests.push(testId);
                continue;
            }

            // Check if the test is already in the batch
            if (batch.tests.some(existingTest => existingTest.equals(testId))) {
                alreadyAddedTests.push(testId);
                continue;
            }

            // Add the test to the batch's tests array if not already there
            batch.tests.push(testId);
            addedTests.push(test);

            // Check if the batch is already in the test's batch_ids array
            if (!test.batch_ids.includes(batchId)) {
                test.batch_ids.push(batchId);
                await test.save(); // Save the updated test document
            }
        }

        // Save the updated batch document
        await batch.save();

        // Prepare response data
        const responseData = {
            message: 'Tests added or updated in batch successfully',
            addedTests,
            alreadyAddedTests,
            notFoundTests,
            batch
        };

        res.json(formatResponse(true, responseData));
    } catch (error) {
        console.error(error);
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Remove a test from a batch (admin access only)
router.delete('/remove-test/:batchId/:testId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.batchId);
        if (!batch) return res.status(404).json({ message: 'Batch not found' });

        // Check if the test is already removed or not present in the batch's tests array
        const testIndex = batch.tests.findIndex(testId => testId.equals(req.params.testId));
        if (testIndex === -1) {
            return res.status(400).json(formatResponse(false, { message: 'Test not found in batch' }));
        }

        // Remove the test from the batch's tests array
        batch.tests.splice(testIndex, 1); // Remove the test by index
        await batch.save();

        res.status(200).json(formatResponse(true, { message: 'Test removed successfully' })); // Success response
    } catch (error) {
        console.error(error); // Log the error for debugging
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message })); // Error response
    }
});

// Update batch details (admin access only)
router.put('/update/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Remove fields that shouldn't be updated directly
        delete updateData.students;  // Students should be managed through enroll route
        delete updateData.tests;     // Tests should be managed through add-tests route
        delete updateData.admin_id;  // Admin ID shouldn't be changed

        // Find and update the batch
        const updatedBatch = await Batch.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('students tests');

        if (!updatedBatch) {
            return res.status(404).json(formatResponse(false, { message: 'Batch not found' }));
        }

        res.json(formatResponse(true, {
            message: 'Batch updated successfully',
            batch: updatedBatch
        }));
    } catch (error) {
        console.error('Error updating batch:', error);
        if (error.code === 11000) {
            return res.status(400).json(formatResponse(false, { message: 'Batch name must be unique' }));
        }
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

module.exports = router;
