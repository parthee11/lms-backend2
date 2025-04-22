const { AppError } = require('./errorHandler');

/**
 * Validates MongoDB ObjectId
 */
const isValidObjectId = (id) => {
    return id && id.match(/^[0-9a-fA-F]{24}$/);
};

/**
 * Validates test duration
 */
const validateTestDuration = (startTime, duration) => {
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    return new Date() <= endTime;
};

/**
 * Validates question state
 */
const validateQuestionState = (state) => {
    const validStates = ['answered', 'review', 'flagged', 'unanswered'];
    return validStates.includes(state);
};

/**
 * Validates test result request
 */
const validateTestResultRequest = (testResult, question_id, selected_option) => {
    if (!testResult) {
        throw new AppError('Test result not found', 404);
    }

    if (testResult.submission_time) {
        throw new AppError('Test has already been submitted', 400);
    }

    if (!isValidObjectId(question_id)) {
        throw new AppError('Invalid question ID', 400);
    }

    if (selected_option && !isValidObjectId(selected_option)) {
        throw new AppError('Invalid option ID', 400);
    }
};

module.exports = {
    isValidObjectId,
    validateTestDuration,
    validateQuestionState,
    validateTestResultRequest
};
