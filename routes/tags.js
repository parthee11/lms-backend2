const express = require('express');
const router = express.Router();
const Tag = require('../models/Tag'); // Import the Tag model
const Question = require('../models/Question'); // Import the Question model for question search
const authMiddleware = require('../middleware/auth'); // Import authentication middleware
const adminMiddleware = require('../middleware/adminMiddleware'); // Import admin middleware
const formatResponse = require('../utils/responseFormatter'); // Import response formatter

// Function to decode buffer based on its content
const decodeBuffer = (buffer) => {
    try {
        return buffer.toString('utf-8'); // Try UTF-8 first
    } catch {
        return buffer.toString('base64'); // If UTF-8 fails, fall back to Base64
    }
};

// Create a new tag
router.post('/create', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { tag_name } = req.body;

        let tag = await Tag.findOne({ tag_name });
        if (tag) {
            return res.status(400).json(formatResponse(false, { message: 'Tag already exists', tag }));
        }

        tag = new Tag({ tag_name, count: 0 });
        await tag.save();

        res.status(201).json(formatResponse(true, tag));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Delete a tag by ID
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const tag = await Tag.findById(req.params.id);
        if (!tag) {
            return res.status(404).json(formatResponse(false, { message: 'Tag not found' }));
        }

        // Check if this tag is used in any question
        const questionCount = await Question.countDocuments({ tags: tag._id });
        if (questionCount > 0) {
            return res.status(400).json(formatResponse(false, { message: 'Tag is being used in questions and cannot be deleted' }));
        }

        // Use deleteOne instead of remove
        await Tag.deleteOne({ _id: tag._id });

        res.status(200).json(formatResponse(true, { message: 'Tag deleted successfully' }));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Update tag name without changing its _id
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { tag_name } = req.body;

        // Check if another tag with the same name already exists
        const existingTag = await Tag.findOne({ tag_name });
        if (existingTag && existingTag._id.toString() !== req.params.id) {
            return res.status(400).json(formatResponse(false, { message: 'Another tag with this name already exists' }));
        }

        const tag = await Tag.findById(req.params.id);
        if (!tag) {
            return res.status(404).json(formatResponse(false, { message: 'Tag not found' }));
        }

        tag.tag_name = tag_name;
        await tag.save();

        res.status(200).json(formatResponse(true, tag));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Optimized route with lean query, pagination, and improved tag lookup
router.get('/questions', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { tags, limit = 10, skip = 0 } = req.query; // Pagination added

        const parsedLimit = parseInt(limit);
        const parsedSkip = parseInt(skip);

        let questionsQuery;
        let totalDocuments;

        if (!tags || tags.length === 0) {
            // If no tags are provided, fetch questions with no tags assigned (empty or null tag_names)
            questionsQuery = Question.find({ $or: [{ 'tag_names': { $exists: false } }, { 'tag_names': { $size: 0 } }] })
                .limit(parsedLimit)
                .skip(parsedSkip)
                .select('question options correct_answer reasoning tags') // Select only needed fields
                .lean(); // Returns plain JS objects instead of Mongoose documents

            // Count total documents matching the query
            totalDocuments = await Question.countDocuments({ $or: [{ 'tag_names': { $exists: false } }, { 'tag_names': { $size: 0 } }] });
        } else {
            const tagArray = tags.split(',').map(tag => tag.trim());

            // Fetch questions with tag matching in tag_names field (denormalized tags)
            questionsQuery = Question.find({ 'tag_names': { $all: tagArray } })
                .limit(parsedLimit)
                .skip(parsedSkip)
                .select('question options correct_answer reasoning tags') // Select only needed fields
                .lean(); // Returns plain JS objects instead of Mongoose documents

            // Count total documents matching the query
            totalDocuments = await Question.countDocuments({ 'tag_names': { $all: tagArray } });
        }

        // Populate tags with the full tag documents if tags are present
        questionsQuery = questionsQuery.populate('tags');

        const questions = await questionsQuery;

        if (questions.length === 0) {
            return res.status(404).json(formatResponse(false, { message: 'No questions found' }));
        }

        // Decode Buffer fields (decoding logic unchanged)
        const decodedQuestions = questions.map(question => ({
            _id: question._id,
            question: decodeBuffer(question.question),
            options: question.options.map(option => ({
                key: option.key,
                value: decodeBuffer(option.value),
            })),
            correct_answer: question.correct_answer,
            reasoning: decodeBuffer(question.reasoning),
            tags: question.tags // Now populated with full tag documents, if any
        }));

        // Calculate total pages
        const totalPages = Math.ceil(totalDocuments / parsedLimit);

        res.status(200).json(formatResponse(true, {
            questions: decodedQuestions,
            totalPages,
            totalDocuments,
        }));
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json(formatResponse(false, { message: 'Server error', error: error.message }));
    }
});

// Fuzzy search for tag names
router.get('/search/:query', authMiddleware, async (req, res) => {
    try {
        const query = req.params.query;

        // Perform a case-insensitive fuzzy search using regex
        const tags = await Tag.find({ tag_name: { $regex: query, $options: 'i' } });

        if (tags.length === 0) {
            return res.status(404).json(formatResponse(false, { message: 'No tags found matching the search query' }));
        }

        res.status(200).json(formatResponse(true, tags));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

// Get all tags with their counts (optional route)
router.get('/all', authMiddleware, async (req, res) => {
    try {
        const tags = await Tag.find({});
        res.status(200).json(formatResponse(true, tags));
    } catch (error) {
        res.status(500).json(formatResponse(false, { message: 'Server error' }));
    }
});

module.exports = router;
