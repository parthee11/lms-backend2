const express = require('express');
const router = express.Router();
const Test = require('../models/Test');
const Question = require('../models/Question'); 
const User = require('../models/User'); 
const Batch = require('../models/Batch'); 
const authMiddleware = require('../middleware/auth'); 
const adminMiddleware = require('../middleware/adminMiddleware'); 
const formatResponse = require('../utils/responseFormatter'); 
const TestResult = require('../models/TestResult');

// Function to decode buffer based on its content
const decodeBuffer = (buffer) => {
    try {
        const str = buffer.toString('utf-8'); 
        return str; 
    } catch {
        return buffer.toString('base64'); 
    }
};

// Create a new test with either text or images
router.post('/create', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { test_name, batch_id, questions, timing, positive_scoring, negative_scoring, cut_off } = req.body;

        // Validate required fields
        if (!test_name || !batch_id || !timing || !positive_scoring) {
            return res.status(400).json(formatResponse(false, { message: 'Missing required fields' }));
        }

        // Verify batch exists
        const batch = await Batch.findById(batch_id);
        if (!batch) {
            return res.status(404).json(formatResponse(false, { message: 'Batch not found' }));
        }

        // Process questions if provided
        let processedQuestions = [];
        if (questions && Array.isArray(questions)) {
            processedQuestions = await Promise.all(questions.map(async (questionData) => {
                const { question, options, correct_answer, reasoning } = questionData;

                // Create new question
                const newQuestion = new Question({
                    question: Buffer.from(question),
                    options: options.map(opt => ({
                        key: opt.key,
                        value: Buffer.from(opt.value)
                    })),
                    correct_answer,
                    reasoning: Buffer.from(reasoning || '')
                });

                await newQuestion.save();
                return newQuestion._id;
            }));
        }

        // Create new test
        const newTest = new Test({
            test_name,
            batch_id,
            questions: processedQuestions, 
            timing,
            positive_scoring,
            negative_scoring: negative_scoring || 0, // Default to 0 if not provided
            cut_off: cut_off || 35 // Default to 35% if not provided
        });

        const savedTest = await newTest.save();

        // Add test to batch's tests array
        batch.tests.push(savedTest._id);
        await batch.save();

        res.json(formatResponse(true, savedTest));
    } catch (err) {
        console.error('Error creating test:', err);
        res.status(500).json(formatResponse(false, { message: 'Failed to create test', error: err.message }));
    }
});

// Fetch all tests (admin access only)
router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Fetch tests with populated questions
        const tests = await Test.find()
            .populate({
                path: 'questions',
                select: 'question options correct_answer reasoning'
            });

        // Format the tests with defensive checks
        const formattedTests = await Promise.all(tests.map(async test => {
            // Populate questions for this test
            const populatedQuestions = await Promise.all(test.questions.map(async questionId => {
                const question = await Question.findById(questionId);
                if (!question) return null;

                return {
                    _id: question._id,
                    question: decodeBuffer(question.question),
                    options: question.options.map(option => ({
                        _id: option._id,
                        key: option.key,
                        value: decodeBuffer(option.value)
                    })),
                    correct_answer: question.correct_answer,
                    reasoning: decodeBuffer(question.reasoning)
                };
            }));

            return {
                _id: test._id,
                test_name: test.test_name,
                questions: populatedQuestions.filter(q => q !== null),
                timing: test.timing,
                positive_scoring: test.positive_scoring,
                negative_scoring: test.negative_scoring || 0,
                batch_id: test.batch_id,
                cut_off: test.cut_off
            };
        }));

        res.json(formatResponse(true, formattedTests));
    } catch (error) {
        console.error('Error fetching tests:', error);
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Route to fetch all tests available to the user based on their batch
router.get('/my-tests', authMiddleware, async (req, res) => {
    try {
        // Get the authenticated user's ID from the request
        const userId = req.userId;

        // Fetch the user from the database, including their batch
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json(formatResponse(false, { message: 'User not found' }));
        }

        // Fetch tests associated with all user's batches
        const tests = await Test.find({ batch_id: { $in: user.batches } })
            .populate({
                path: 'questions',
                model: 'Question',
                select: 'question options correct_answer reasoning'
            })
            .populate('batch_id');

        // Format tests for the response
        const formattedTests = tests.map(test => ({
            _id: test._id,
            test_name: test.test_name,
            batch_id: test.batch_id,
            questions: test.questions.map(question => ({
                _id: question._id,
                question: decodeBuffer(question.question),
                options: question.options.map(option => ({
                    _id: option._id,
                    key: option.key,
                    value: decodeBuffer(option.value)
                })),
                correct_answer: question.correct_answer,
                reasoning: decodeBuffer(question.reasoning)
            })),
            timing: test.timing,
            positive_scoring: test.positive_scoring,
            negative_scoring: test.negative_scoring || 0,
            cut_off: test.cut_off,
            hasHistory: test.hasHistory,
            max_score: test.max_score,
            total_questions: test.total_questions
        }));

        res.json(formatResponse(true, formattedTests));
    } catch (error) {
        console.error('Error fetching user tests:', error);
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Fuzzy search for tests by name (admin access only)
router.get('/search', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { query } = req.query; 
        if (!query || query.trim() === "") {
            return res.status(400).json(formatResponse(false, { message: 'Search query is required' }));
        }

        // Perform a case-insensitive regex search for test names
        const tests = await Test.find({
            test_name: { $regex: query, $options: 'i' } 
        });

        // Format the response to include essential test details
        const formattedTests = tests.map(test => ({
            _id: test._id,
            test_name: test.test_name,
            timing: test.timing,
            positive_scoring: test.positive_scoring,
            negative_scoring: test.negative_scoring || 0,
            cut_off: test.cut_off
        }));

        res.json(formatResponse(true, formattedTests));
    } catch (error) {
        console.error(error);
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Fetch a test by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const test = await Test.findById(req.params.id)
            .populate({
                path: 'questions',
                model: 'Question',
                select: 'question options correct_answer reasoning'
            })
            .populate('batch_id');

        if (!test) {
            return res.status(404).json(formatResponse(false, { message: 'Test not found' }));
        }

        const processedQuestions = test.questions.map(question => ({
            _id: question._id,
            question: decodeBuffer(question.question),
            options: question.options.map(option => ({
                _id: option._id,
                key: option.key,
                value: decodeBuffer(option.value)
            })),
            correct_answer: question.correct_answer,
            reasoning: decodeBuffer(question.reasoning)
        }));

        res.json(formatResponse(true, { ...test.toObject(), questions: processedQuestions })); 
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Update a test by ID (admin access only)
router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { id } = req.params;
        const { test_name, batch_id, timing, positive_scoring, negative_scoring, cut_off } = req.body;

        // Find the test
        const test = await Test.findById(id);
        if (!test) {
            return res.status(404).json(formatResponse(false, { message: 'Test not found' }));
        }

        // If batch is being changed
        if (batch_id && batch_id !== test.batch_id.toString()) {
            // Verify new batch exists
            const newBatch = await Batch.findById(batch_id);
            if (!newBatch) {
                return res.status(404).json(formatResponse(false, { message: 'New batch not found' }));
            }

            // Remove test from old batch
            const oldBatch = await Batch.findById(test.batch_id);
            if (oldBatch) {
                oldBatch.tests = oldBatch.tests.filter(testId => testId.toString() !== id);
                await oldBatch.save();
            }

            // Add test to new batch
            newBatch.tests.push(test._id);
            await newBatch.save();

            // Update test's batch_id
            test.batch_id = batch_id;
        }

        // Update other fields if provided
        if (test_name) test.test_name = test_name;
        if (timing) test.timing = timing;
        if (positive_scoring) test.positive_scoring = positive_scoring;
        if (negative_scoring !== undefined) test.negative_scoring = negative_scoring;
        if (cut_off) test.cut_off = cut_off;

        await test.save();

        // Return populated test
        const updatedTest = await Test.findById(id)
            .populate('batch_id')
            .populate('questions');

        res.json(formatResponse(true, updatedTest));
    } catch (err) {
        console.error('Error updating test:', err);
        res.status(500).json(formatResponse(false, { message: 'Failed to update test', error: err.message }));
    }
});

// Delete a test by ID (admin access only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) {
            return res.status(404).json(formatResponse(false, { message: 'Test not found' }));
        }

        // Remove the test reference from all associated batches
        await Batch.updateMany(
            { tests: test._id }, 
            { $pull: { tests: test._id } } 
        );

        // Delete the test itself
        await test.deleteOne(); 

        res.json(formatResponse(true, { message: 'Test deleted and references cleaned successfully' }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Add a question to a test (admin only)
router.put('/:id/add-question', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { question, options, correct_answer, reasoning } = req.body;

        // Create and save new Question document
        const newQuestion = new Question({
            question: Buffer.from(question, question.startsWith('data:image/') ? 'base64' : 'utf-8'),
            options: options.map(option => ({
                key: option.key,
                value: Buffer.from(option.value, option.value.startsWith('data:image/') ? 'base64' : 'utf-8')
            })),
            correct_answer,
            reasoning: Buffer.from(reasoning, reasoning.startsWith('data:image/') ? 'base64' : 'utf-8')
        });

        const savedQuestion = await newQuestion.save();

        // Find test and add question reference
        const test = await Test.findById(id);
        if (!test) {
            return res.status(404).json(formatResponse(false, { message: 'Test not found' }));
        }

        test.questions.push(savedQuestion._id);  
        await test.save();

        res.json(formatResponse(true, { 
            message: 'Question added successfully', 
            questionId: savedQuestion._id,
            test 
        }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Remove a question from a test by question ID (admin only)
router.put('/:id/remove-question/:questionId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id, questionId } = req.params;

        const test = await Test.findById(id);
        if (!test) {
            return res.status(404).json(formatResponse(false, { message: 'Test not found' }));
        }

        // Check if question exists in the test
        if (!test.questions.includes(questionId)) {
            return res.status(404).json(formatResponse(false, { message: 'Question not found in this test' }));
        }

        // Remove the question reference from the test
        test.questions = test.questions.filter(qId => qId.toString() !== questionId);
        await test.save();

        // Delete the actual Question document
        await Question.findByIdAndDelete(questionId);

        res.json(formatResponse(true, { message: 'Question removed successfully', test }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

module.exports = router;