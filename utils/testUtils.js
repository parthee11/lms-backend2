const Test = require('../models/Test');
const Question = require('../models/Question');
const TestResult = require('../models/TestResult');
const mongoose = require('mongoose');

/**
 * Finalizes a test result by:
 * - Setting submission time
 * - Processing all answers
 * - Adding unanswered questions
 * - Calculating total score
 * 
 * @param {Object} testResult - The test result document to finalize
 * @param {Date} endTime - The time when the test ended
 * @returns {Promise<Object>} The finalized test result
 */
const finalizeTestResult = async (testResult, submissionTime = new Date()) => {
    try {
        // Get the test details for scoring
        const test = await Test.findById(testResult.test_id);
        if (!test) {
            throw new Error('Test not found');
        }

        let totalScore = 0;

        // Process answered questions
        const answeredQuestions = testResult.answers.filter(answer => answer.state === 'answered');
        for (const answer of answeredQuestions) {
            if (answer.is_correct) {
                totalScore += test.positive_scoring;
            } else if (test.negative_scoring) {
                // Only apply negative scoring if it's set
                totalScore -= test.negative_scoring;
            }
        }

        // Process unanswered questions - No negative marking
        const unansweredQuestions = testResult.answers.filter(answer => answer.state === 'unanswered');
        // No score modification for unanswered questions

        // Ensure score doesn't go below 0
        totalScore = Math.max(0, totalScore);

        // Update test result with final score, submission time, and pass/fail status
        testResult.total_score = totalScore;
        testResult.submission_time = submissionTime;
        testResult.max_score = test.max_score; // Ensure max_score is set
        testResult.test_result = (totalScore / test.max_score * 100) >= test.cut_off;

        await testResult.save();
        
        // Return populated result
        return await TestResult.findById(testResult._id)
            .populate('test_id')
            .populate('answers.question_id');
    } catch (error) {
        console.error('Error in finalizeTestResult:', error);
        throw error;
    }
};

module.exports = {
    finalizeTestResult
};
