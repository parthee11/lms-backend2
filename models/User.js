const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
        name: { type: String },
        age: { type: Number },
        gender: { type: String, enum: ['male', 'female', 'other', 'not mentioned'], default: 'not mentioned' },
        dob: { type: Date },
        phone: { type: String },
        address: {
            street: String,
            city: String,
            state: String,
            postalCode: String,
            country: String
        }
    },
    rank: { type: Number, default: 0 },  // Field outside of profile for rank
    role: { type: String, enum: ['admin', 'student'], default: 'student' }, // Role field
    lms_score: { type: Number, default: 0 },  // Field outside of profile for LMS score
    batches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }]
});

module.exports = mongoose.model('User', userSchema);
