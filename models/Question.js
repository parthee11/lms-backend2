const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    key: { type: Number, required: true }, // Key can be 1, 2, 3, etc.
    value: { type: Buffer, required: true }, // Text or image data as Buffer
});

const questionSchema = new mongoose.Schema({
    question: { type: Buffer, required: true }, // Store image or text data as Buffer
    options: [optionSchema], // Array of option objects
    correct_answer: { type: Number, required: true }, // Index of the correct answer
    reasoning: { type: Buffer, required: true },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }], // Array of Tag references
    tag_names: [{ type: String }] // Optional: Denormalize tags for faster lookup
});

// Optional: Index on `tags` if you plan on querying based on tags
questionSchema.index({ tags: 1 });
questionSchema.index({ tag_names: 1 }); // Index on tag_names for faster lookup

module.exports = mongoose.model('Question', questionSchema);
