const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    location: { type: String, required: true }, // This will be your room number
    status: { type: String, required: true }, // e.g., "In Class"
    gps: {
        lat: Number,
        lng: Number
    },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attendance', AttendanceSchema);