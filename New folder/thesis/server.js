require('dns').setServers(['8.8.8.8', '8.8.4.4']); // Forces use of Google DNS
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const qrcode = require('qrcode');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Attendance = require('./Attendance');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static('public'));

app.use(session({ 
    secret: 'thesis_secret_key', 
    resave: false, 
    saveUninitialized: true 
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    callbackURL: "https://squeegee-spray-drone.ngrok-free.dev/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Change this line in your server.js
const dbURI = process.env.MONGODB_URI;

mongoose.connect(dbURI)
  .then(() => console.log("✅ Success: Connected to MongoDB Atlas Cloud!"))
  .catch(err => console.error("❌ Cloud Connection Error:", err));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login-page' }),
  (req, res) => {
    res.redirect('/scan?room=Room101');
  }
);

app.get('/', (req, res) => {
    res.send('Attendance System Server is Running! 🚀');
});

app.get('/generateQR/:roomName', async (req, res) => {
    try {
        const url = `https://squeegee-spray-drone.ngrok-free.dev/scan?room=${req.params.roomName}`;
        const qrImage = await qrcode.toDataURL(url);
        res.send(`<img src="${qrImage}"/> <p>Scan this to check into ${req.params.roomName}</p>`);
    } catch (err) {
        res.status(500).send("Error generating QR");
    }
});

app.get('/scan', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'scan.html'));
});

app.post('/record-attendance', async (req, res) => {
    try {
        const { employeeId, location, status, gps } = req.body;
        await Attendance.create({ 
            employeeId, 
            location, 
            status, 
            gps, 
            timestamp: new Date() 
        });
        res.status(200).send("Record Saved");
    } catch (err) {
        console.error(err);
        res.status(500).send("Database Error");
    }
});

app.post('/login', async (req, res) => {
    const { user, pass, role } = req.body;
    if (role === 'Chairperson') {
        if (user === "admin" && pass === "chair123") {
            return res.json({ success: true, redirect: '/dashboard' });
        } else {
            return res.json({ success: false, message: "Invalid Admin Credentials" });
        }
    }
});

app.get('/login-page', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/get-attendance', async (req, res) => {
    try {
        const records = await Attendance.find().sort({ timestamp: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).send("Error fetching dashboard data");
    }
});

app.get('/user-info', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ name: req.user.displayName });
    } else {
        res.json({ name: "Unknown Faculty" });
    }
});

// ROUTE TO CLEAR LOGS
app.post('/clear-attendance', async (req, res) => {
    try {
        await Attendance.deleteMany({}); 
        res.status(200).send("Logs Cleared");
    } catch (err) {
        res.status(500).send("Error clearing logs");
    }
});

server.listen(3000, () => {
    console.log('🚀 Server is live at http://localhost:3000');
});