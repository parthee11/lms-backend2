const mongoose = require('mongoose');

// Define an enumeration for question states
const questionStateEnum = {
    ANSWERED: 'answered',
    MARKED_FOR_REVIEW: 'review',  // Updated value
    FLAGGED_FOR_LATER: 'flagged',  // Updated value
    UNANSWERED: 'unanswered',  // A default state if needed
};

const testResultSchema = new mongoose.Schema({
    test_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Test',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        required: true
    },
    answers: [{
        question_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question',
            required: true
        },
        selected_option: {
            type: mongoose.Schema.Types.ObjectId
        },
        is_correct: {
            type: Boolean,
            default: false
        },
        state: {
            type: String,
            enum: questionStateEnum,
            default: 'unanswered'
        }
    }],
    total_score: {
        type: Number,
        default: 0
    },
    max_score: {
        type: Number,
        required: true
    },
    test_result: {
        type: Boolean,
        default: false
    },
    start_time: {
        type: Date,
        default: Date.now
    },
    submission_time: {
        type: Date
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual properties for answer statistics
testResultSchema.virtual('total_answered').get(function() {
    return this.answers.filter(answer => answer.state === 'answered').length;
});

testResultSchema.virtual('total_unanswered').get(function() {
    return this.answers.filter(answer => answer.state === 'unanswered').length;
});

// Pre-save middleware to copy max_score from test and update test_result
testResultSchema.pre('save', async function(next) {
    try {
        const Test = mongoose.model('Test');
        const test = await Test.findById(this.test_id);
        
        if (test) {
            // Copy max_score for new test results
            if (this.isNew) {
                this.max_score = test.max_score;
                
                // Update hasHistory on the test if this is the first attempt
                if (!test.hasHistory) {
                    await Test.findByIdAndUpdate(this.test_id, { hasHistory: true });
                }
            }

            // Calculate test result if the test is submitted
            if (this.submission_time) {
                // Calculate percentage score
                const percentageScore = (this.total_score / this.max_score) * 100;
                // Update test_result based on cut_off
                this.test_result = percentageScore >= test.cut_off;
            }
        }
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('TestResult', testResultSchema);
