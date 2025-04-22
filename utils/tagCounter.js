const Tag = require('../models/Tag');

// Helper function to handle tags (find or create and increment count)
const incrementTagCount = async (tags) => {
    const tagIds = [];
    for (let tagName of tags) {
        let tag = await Tag.findOne({ tag_name: tagName });
        if (tag) {
            tag.count += 1; // Increment the count if the tag exists
        } else {
            tag = new Tag({ tag_name: tagName, count: 1 }); // Create a new tag
        }
        await tag.save();
        tagIds.push(tag._id); // Store the ObjectId of the tag
    }
    return tagIds;
};

// Helper function to decrement the tag count when a question is removed or tags are updated
const decrementTagCount = async (tagIds) => {
    for (let tagId of tagIds) {
        let tag = await Tag.findById(tagId);
        if (tag) {
            tag.count -= 1; // Decrement the tag count
            if (tag.count <= 0) {
                await Tag.deleteOne({ _id: tag._id }); // Remove the tag if count reaches 0
            } else {
                await tag.save(); // Save the updated count
            }
        }
    }
};

module.exports = { incrementTagCount, decrementTagCount };