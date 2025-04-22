const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    batch_name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String
    },
    start_date: Date,
    end_date: Date,
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    tests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Test'
    }],
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } 
});

module.exports = mongoose.model('Batch', batchSchema);
