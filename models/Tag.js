const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    tag_name: { type: String, required: true, unique: true }, // Tag name, must be unique
    count: { type: Number, default: 0 }, // Count of occurrences in questions
});

// Indexing tag_name for efficient lookup
tagSchema.index({ tag_name: 1 });

module.exports = mongoose.model('Tag', tagSchema);