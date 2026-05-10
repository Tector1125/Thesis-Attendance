const mongoose = require('mongoose');
const User = require('./User');

mongoose.connect('mongodb://127.0.0.1:27017/attendance_db')
    .then(async () => {
        await User.create({
            name: "Test Teacher",
            employeeId: "FAC-001",
            role: "Teacher"
        });
        console.log("✅ Faculty Member FAC-001 Created!");
        process.exit();
    });