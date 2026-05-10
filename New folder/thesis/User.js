const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    employeeId: { type: String, unique: true, required: true },
    role: { type: String, enum: ['Teacher', 'Chairperson'], default: 'Teacher' },
    password: { type: String }, // Only the Chairperson really needs this
    status: { type: String, default: 'Absent' }
});

module.exports = mongoose.model('User', UserSchema);