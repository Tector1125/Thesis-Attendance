const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const app = express();

app.use(express.json());

// 1. Session Setup
app.use(session({
    secret: 'thesis_secret_key_654321',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// 2. Google Strategy Configuration (Fixed to use Render Environment Variables)
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://thesis-attendance.onrender.com/auth/google/callback" 
},
async (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

// 3. Database Connection Path
const dbURI = "mongodb://Gaius:hyukkwonhyukkwon11@cluster0-shard-00-00.9em3kfg.mongodb.net:27017,cluster0-shard-00-01.9em3kfg.mongodb.net:27017,cluster0-shard-00-02.9em3kfg.mongodb.net:27017/attendance_db?ssl=true&replicaSet=atlas-135scz-shard-0&authSource=admin&retryWrites=true&w=majority";

console.log("📡 Attempting Direct Shard Routing...");
mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 15000,
    family: 4 
})
.then(() => console.log("✅ SUCCESS: Database connected perfectly!"))
.catch(err => console.error("❌ DATABASE FAILED:", err.message));

// 4. AUTHENTICATION ROUTES
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login-page' }),
    (req, res) => {
        res.redirect('/login-page'); 
    }
);

// 5. DATA ROUTES
app.get('/get-attendance', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).send("Database is connecting... Refresh in 5 seconds.");
        }
        const db = mongoose.connection.useDb('attendance_db');
        const records = await db.collection('attendances').find().toArray();
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const path = require('path');

// Route to serve the login page smoothly
app.get('/login-page', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route to serve your dashboard smoothly
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 6. DYNAMIC PORT BINDING (Fixed to prevent Render "Exited Early" crash)
const PORT = process.env.PORT || 5050;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVER ACTIVE & LIVE ON PORT: ${PORT}`);
});