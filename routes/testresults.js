const express = require('express');
const mongoose = require('mongoose');
const TestResult = require('../models/TestResult');
const Test = require('../models/Test');
const Question = require('../models/Question');
const authMiddleware = require('../middleware/auth');
const formatResponse = require('../utils/responseFormatter');
const { finalizeTestResult } = require('../utils/testUtils');

const router = express.Router();

// 1. Create a new test attempt (start a test)
router.post('/create', authMiddleware, async (req, res) => {
    try {
        const { test_id } = req.body;

        // Validate test_id
        if (!mongoose.Types.ObjectId.isValid(test_id)) {
            return res.status(400).json(formatResponse(false, { message: 'Invalid test ID format' }));
        }

        // Check if test exists
        const test = await Test.findById(test_id);
        if (!test) {
            return res.status(404).json(formatResponse(false, { message: 'Test not found' }));
        }

        // Check if user has an ongoing attempt
        const ongoingAttempt = await TestResult.findOne({
            test_id,
            user_id: req.userId,
            submission_time: { $exists: false }
        })
        .populate('test_id')
        .populate('answers.question_id');

        if (ongoingAttempt) {
        // Check if test duration has expired
        const currentTime = new Date();
        const testDuration = ongoingAttempt.test_id.timing * 60 * 1000; // Convert minutes to milliseconds
        const testEndTime = new Date(ongoingAttempt.start_time.getTime() + testDuration);

        if (currentTime > testEndTime) {
            // Auto-submit the test if duration has expired
            const finalizedResult = await finalizeTestResult(ongoingAttempt, testEndTime);
            return res.status(200).json(formatResponse(true, {
                message: 'Test duration expired. Test has been automatically submitted.',
                result: finalizedResult
            }));
        }
        else {
            return res.status(400).json(formatResponse(false, { 
                message: 'You have an ongoing attempt for this test',
                testResult: ongoingAttempt
            }));
        }

        }

        // Create initial answers array with all questions in unanswered state
        const initialAnswers = test.questions.map(questionId => ({
            question_id: questionId,
            state: 'unanswered',
            is_correct: false
        }));

        // Create new test result
        const testResult = new TestResult({
            test_id,
            user_id: req.userId,
            batch_id: test.batch_id,
            answers: initialAnswers,
            start_time: new Date(),
            total_score: 0, // Initialize total_score as 0
            max_score: test.max_score // Copy max_score from test
        });

        await testResult.save();

        // Populate necessary fields and return
        const populatedResult = await TestResult.findById(testResult._id)
            .populate('test_id')
            .populate('answers.question_id');

        res.json(formatResponse(true, populatedResult));
    } catch (err) {
        console.error('Error creating test result:', err);
        res.status(500).json(formatResponse(false, { message: 'Failed to create test result', error: err.message }));
    }
});

// 2. Update question state in test result
router.put('/update/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { question_id, selected_option, state } = req.body;

        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(question_id)) {
            return res.status(400).json(formatResponse(false, { message: 'Invalid ID format' }));
        }

        // Get test result and verify ownership
        const testResult = await TestResult.findOne({ _id: id, user_id: req.userId })
            .populate('test_id')
            .populate('answers.question_id');
            
        if (!testResult) {
            return res.status(404).json(formatResponse(false, { message: 'Test result not found or unauthorized' }));
        }

        // Check if test is already submitted
        if (testResult.submission_time) {
            return res.status(400).json(formatResponse(false, { message: 'Cannot update submitted test' }));
        }

        // Check if test duration has expired
        const currentTime = new Date();
        const testDuration = testResult.test_id.timing * 60 * 1000; // Convert minutes to milliseconds
        const testEndTime = new Date(testResult.start_time.getTime() + testDuration);

        if (currentTime > testEndTime) {
            // Auto-submit the test if duration has expired
            const finalizedResult = await finalizeTestResult(testResult, testEndTime);
            return res.status(200).json(formatResponse(true, {
                message: 'Test duration expired. Test has been automatically submitted.',
                result: finalizedResult
            }));
        }

        // Find the question to verify selected option
        const question = await Question.findById(question_id);
        if (!question) {
            return res.status(404).json(formatResponse(false, { message: 'Question not found' }));
        }

        // Verify selected option belongs to question if provided
        let is_correct = false;
        if (selected_option) {
            const option = question.options.id(selected_option);
            if (!option) {
                return res.status(400).json(formatResponse(false, { message: 'Invalid option selected' }));
            }
            is_correct = option.key === question.correct_answer;
        }

        // Find the answer index
        const answerIndex = testResult.answers.findIndex(answer => 
            answer.question_id._id.toString() === question_id
        );

        if (answerIndex === -1) {
            console.log('Answer not found. Current answers:', testResult.answers);
            return res.status(400).json(formatResponse(false, { 
                message: 'Answer not initialized for this question',
                debug: {
                    questionId: question_id,
                    existingAnswers: testResult.answers.map(a => ({
                        id: a.question_id._id.toString(),
                        state: a.state
                    }))
                }
            }));
        }

        // Update the specific answer in the array
        await TestResult.findByIdAndUpdate(
            id,
            { 
                $set: { 
                    [`answers.${answerIndex}`]: {
                        question_id,
                        selected_option,
                        state: state || 'answered',
                        is_correct
                    }
                }
            },
            { new: true }
        );

        // Fetch the updated document
        const updatedResult = await TestResult.findById(id)
            .populate('test_id')
            .populate('answers.question_id');

        res.json(formatResponse(true, updatedResult));
    } catch (err) {
        console.error('Error updating test result:', err);
        res.status(500).json(formatResponse(false, { message: 'Failed to update test result', error: err.message }));
    }
});

// 3. Get all test results for a specific test
router.get('/by-test/:test_id', authMiddleware, async (req, res) => {
    try {
        const { test_id } = req.params;

        // Validate test_id
        if (!mongoose.Types.ObjectId.isValid(test_id)) {
            return res.status(400).json(formatResponse(false, { 
                message: 'Invalid test ID format' 
            }));
        }

        const results = await TestResult.find({ test_id, user_id: req.userId })
            .populate('test_id')
            .populate('answers.question_id');

        // Add total_questions to each test result
        const processedResults = results.map(result => {
            const resultObj = result.toObject();
            // Add total_questions from the test or calculate from answers array
            resultObj.total_questions = result.test_id?.total_questions || result.answers.length;
            return resultObj;
        });

        res.json(formatResponse(true, processedResults));
    } catch (err) {
        console.error('Error fetching test results:', err);
        res.status(500).json(formatResponse(false, { message: 'Failed to fetch test results', error: err.message }));
    }
});

// 4. Submit test result (update submission time and finalize)
router.put('/submit/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Validate test result ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json(formatResponse(false, { message: 'Invalid test result ID format' }));
        }

        // Find test result with populated fields
        const testResult = await TestResult.findOne({ 
            _id: id, 
            user_id: req.userId,
            submission_time: { $exists: false } // Only find unsubmitted tests
        }).populate('test_id')
          .populate('answers.question_id');

        if (!testResult) {
            return res.status(404).json(formatResponse(false, { message: 'Test result not found, already submitted, or unauthorized' }));
        }

        // Check if test exists and is populated
        if (!testResult.test_id) {
            return res.status(404).json(formatResponse(false, { message: 'Associated test not found' }));
        }

        // Check if test duration has expired
        const currentTime = new Date();
        const testDuration = testResult.test_id.timing * 60 * 1000; // Convert minutes to milliseconds
        const testEndTime = new Date(testResult.start_time.getTime() + testDuration);

        // Finalize the test result with appropriate end time
        const finalEndTime = currentTime > testEndTime ? testEndTime : currentTime;
        const finalizedResult = await finalizeTestResult(testResult, finalEndTime);
        
        res.json(formatResponse(true, finalizedResult));
    } catch (err) {
        console.error('Error submitting test result:', err);
        res.status(500).json(formatResponse(false, { message: 'Failed to submit test result', error: err.message }));
    }
});

module.exports = router;
