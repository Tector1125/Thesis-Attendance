const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path'); 
const fs = require('fs'); 

const app = express();

app.use(express.json());

// ==========================================
// 1. FRONTEND STATIC FILE & ROUTING CONFIG
// ==========================================
// Dahil nakita natin sa logs na nasa loob ng 'New folder/thesis' si Render, 
// i-lock na natin directly sa local public folder para siguradong laging load ang login.html
const publicPath = path.join(__dirname, 'public'); 

console.log(`📂 Static assets route locked onto: ${publicPath}`);

app.use(express.static(publicPath));

// Login Page Route
app.get('/login-page', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
});


app.get('/dashboard', (req, res) => {
    // If a user is logged in, check their email right here too
    if (req.user && req.user.emails && req.user.emails.length > 0) {
        const userEmail = req.user.emails[0].value;
        if (userEmail !== 'gerrysanchezjr1125@gmail.com') {
            console.log(`⚠️ Unauthorized dashboard access attempt by ${userEmail}. Redirecting to scanner.`);
            return res.redirect('/scan.html');
        }
    }
    // If they are the chairperson or session isn't locked, let them view it
    res.sendFile(path.join(publicPath, 'dashboard.html'));
});


// ==========================================
// 2. SESSION & PASSPORT SETUP
// ==========================================
app.use(session({
    secret: 'thesis_secret_key_654321',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));


// ==========================================
// 3. GOOGLE OAUTH STRATEGY
// ==========================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://thesis-attendance-1.onrender.com/auth/google/callback" 
},
async (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));


// ==========================================
// 4. DATABASE CONNECTION
// ==========================================
// We point directly to the base cluster, allowing Mongoose to handle the 'attendance_db' context dynamically
const dbURI = process.env.MONGODB_URI || "mongodb+srv://Gaius:GaiusThesis2026@thesiscluster.9em3kfg.mongodb.net/?retryWrites=true&w=majority";

console.log("📡 Attempting Database Connection...");
mongoose.connect(dbURI, {
    dbName: 'attendance_db', // 👈 Forces Mongoose to establish and name the database context explicitly here
    serverSelectionTimeoutMS: 15000,
    family: 4 
})
.then(() => console.log("✅ SUCCESS: Database connected perfectly!"))
.catch(err => console.error("❌ DATABASE FAILED:", err.message));


// ==========================================
// 5. AUTHENTICATION ENDPOINTS
// ==========================================
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login-page' }),
    (req, res) => {
        // 1. Grab the email of the person who just logged in
        const userEmail = req.user.emails[0].value;
        
        // 2. Identify your email vs. other faculty members
        // Change this email string to match whichever account is the actual Chairperson
        if (userEmail === 'gerrysanchezjr1125@gmail.com') {
            console.log(`👑 Chairperson Detected: ${userEmail}. Routing to Monitor.`);
            res.redirect('/dashboard'); 
        } else {
            console.log(`📋 Standard Faculty Detected: ${userEmail}. Routing to Scanner.`);
            // Sends all other faculty members straight to your QR scanner interface
            res.redirect('/scan.html'); 
        }
    }
);


// ==========================================
// 6. BACKEND DATA API ENDPOINTS
// ==========================================
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


// ==========================================
// 7. SERVER INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 5050;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVER ACTIVE & LIVE ON PORT: ${PORT}`);
});