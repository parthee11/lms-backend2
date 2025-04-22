const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Tag = require('../models/Tag');
const authMiddleware = require('../middleware/auth'); // Authentication middleware
const adminMiddleware = require('../middleware/adminMiddleware'); // Admin access middleware
const formatResponse = require('../utils/responseFormatter');
const { incrementTagCount, decrementTagCount } = require('../utils/tagCounter'); // Import tag counting utilities

// Create new questions (handling an array of question objects)
router.post('/create', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const questionsArray = req.body; // Expecting an array of question objects

        if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
            return res.status(400).json(formatResponse(false, { message: 'Questions array is required' }));
        }

        const processedQuestions = [];

        for (const questionData of questionsArray) {
            const { question, options, correct_answer, reasoning, tags } = questionData;

            // Convert question and reasoning to Buffer
            const processedQuestion = Buffer.from(question, question.startsWith('data:image/') ? 'base64' : 'utf-8');
            const processedReasoning = Buffer.from(reasoning, reasoning.startsWith('data:image/') ? 'base64' : 'utf-8');

            // Process tags: Find or create tags, and increment their count
            const tagIds = await incrementTagCount(tags);

            // Create tag_names array for denormalized tags
            const tagNames = tags.map(tag => tag.trim().toLowerCase()); // Denormalized array of tag names

            // Create new question object
            const newQuestion = new Question({
                question: processedQuestion,
                options: options.map(option => ({
                    key: option.key,
                    value: Buffer.from(option.value, option.value.startsWith('data:image/') ? 'base64' : 'utf-8'),
                })),
                correct_answer,
                reasoning: processedReasoning,
                tags: tagIds, // Store tag IDs in the question
                tag_names: tagNames // Store tag names in the denormalized array
            });

            processedQuestions.push(newQuestion);
        }

        // Save all questions in bulk
        await Question.insertMany(processedQuestions);

        res.status(201).json(formatResponse(true, { message: 'Questions created successfully', questions: processedQuestions }));
    } catch (error) {
        console.error(error);
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Update an existing question
router.put('/update/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { question, options, correct_answer, reasoning, tags } = req.body;
        const questionId = req.params.id;

        const existingQuestion = await Question.findById(questionId);
        if (!existingQuestion) {
            return res.status(404).json(formatResponse(false, { message: 'Question not found' }));
        }

        // Handle new tags if provided, and skip if empty
        let newTagIds = [];
        if (tags && tags.length > 0) {
            newTagIds = await incrementTagCount(tags);
        }

        // Handle old tags: Decrement their count
        const oldTagIds = existingQuestion.tags;
        if (oldTagIds && oldTagIds.length > 0) {
            await decrementTagCount(oldTagIds);
        }

        // Update the question data
        existingQuestion.question = question ? Buffer.from(question, question.startsWith('data:image/') ? 'base64' : 'utf-8') : existingQuestion.question;
        existingQuestion.options = options ? options.map(option => ({
            key: option.key,
            value: Buffer.from(option.value, option.value.startsWith('data:image/') ? 'base64' : 'utf-8'),
        })) : existingQuestion.options;
        existingQuestion.correct_answer = correct_answer || existingQuestion.correct_answer;
        existingQuestion.reasoning = reasoning ? Buffer.from(reasoning, reasoning.startsWith('data:image/') ? 'base64' : 'utf-8') : existingQuestion.reasoning;

        // Update tags if new tags are provided
        if (newTagIds.length > 0) {
            existingQuestion.tags = newTagIds; // Set the new tag ObjectIds
            existingQuestion.tag_names = tags;  // Set the new tag names (denormalized field)
        }

        await existingQuestion.save();
        res.status(200).json(formatResponse(true, existingQuestion));
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Delete a question
router.delete('/delete/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const questionId = req.params.id;

        const questionToDelete = await Question.findById(questionId);
        if (!questionToDelete) {
            return res.status(404).json(formatResponse(false, { message: 'Question not found' }));
        }

        // Decrement tag counts for the tags associated with the question
        await decrementTagCount(questionToDelete.tags);

        // Delete the question
        await questionToDelete.deleteOne();
        res.status(200).json(formatResponse(true, { message: 'Question deleted successfully' }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});


module.exports = router;
