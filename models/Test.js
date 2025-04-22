const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    test_name: {
        type: String,
        required: true
    },
    batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        required: true
    },
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    timing: {
        type: Number,
        required: true
    },
    positive_scoring: {
        type: Number,
        required: true
    },
    negative_scoring: {
        type: Number
    },
    max_score: {
        type: Number,
        default: 0  // Will be calculated on save
    },
    total_questions: {
        type: Number,
        default: 0  // Will be calculated on save
    },
    cut_off: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 35  // Default passing percentage
    },
    hasHistory: {
        type: Boolean,
        default: false
    }
});

// Pre-save middleware to calculate max_score and total_questions
testSchema.pre('save', function(next) {
    this.total_questions = this.questions.length;
    this.max_score = this.total_questions * this.positive_scoring;
    next();
});

module.exports = mongoose.model('Test', testSchema);
