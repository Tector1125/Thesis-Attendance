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
// 1. FRONTEND STATIC FILE & ROUTING CONFIG (EXPLICIT SUBFOLDER PATHS)
// ==========================================
// This directs Express directly into the public/views layout structure
const publicPath = path.join(__dirname, 'public');
const viewsPath = path.join(__dirname, 'public', 'views');

console.log(`📂 Static assets route locked onto: ${publicPath}`);
console.log(`📄 HTML files route locked onto: ${viewsPath}`);

// Serve static assets out of the verified public folder
app.use(express.static(publicPath));

// ROOT ROUTE: Serves your login layout explicitly from the views subfolder
app.get('/', (req, res) => {
    res.sendFile(path.join(viewsPath, 'login.html'));
});

// LOGIN PAGE ROUTE: Points cleanly to login.html
app.get('/login-page', (req, res) => {
    res.sendFile(path.join(viewsPath, 'login.html'));
});

// DASHBOARD ROUTE
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(viewsPath, 'dashboard.html'));
});

// SCANNER ROUTE
app.get('/scan-page', (req, res) => {
    res.sendFile(path.join(viewsPath, 'scan.html'));
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
const dbURI = process.env.MONGODB_URI || "mongodb+srv://Gaius:GaiusThesis2026@thesiscluster.9em3kfg.mongodb.net/?retryWrites=true&w=majority";

console.log("📡 Attempting Database Connection...");
mongoose.connect(dbURI, {
    dbName: 'attendance_db', 
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
        
        if (userEmail === 'gerrysanchezjr1125@gmail.com') {
            console.log(`👑 Chairperson Detected: ${userEmail}. Routing to Monitor.`);
            res.redirect('/dashboard'); 
        } else {
            console.log(`📋 Standard Faculty Detected: ${userEmail}. Routing to Scanner.`);
            res.redirect('/scan-page'); 
        }
    }
);


// ==========================================
// 6. BACKEND DATA API ENDPOINTS
// ==========================================

// 1. GET USER INFO ROUTE: Solves the scan-page:72 JSON crash
app.get('/user-info', (req, res) => {
    // If the user is authenticated via Google Passport session
    if (req.user && req.user.emails) {
        return res.json({
            authenticated: true,
            email: req.user.emails[0].value,
            name: req.user.displayName || "Faculty Member"
        });
    }
    
    // Fallback safe payload structure so the frontend script doesn't throw errors
    return res.json({
        authenticated: false,
        email: "guest.faculty@gmail.com",
        name: "Guest Faculty"
    });
});

// 2. RETRIEVE ALL RECORDED ATTENDANCES
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

// 3. POST STATUS UPDATE ROUTE: Matches scan-page:88 exactly
app.post('/record-attendance', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ success: false, error: "Database offline. Try again shortly." });
        }

        // Destructure the data object your frontend is actively sending
        const { employeeId, location, status, gps } = req.body;

        // Extract session name fallback safely if available
        const userName = req.user && req.user.displayName ? req.user.displayName : `Faculty ${employeeId || 'FAC-001'}`;
        const userEmail = req.user && req.user.emails ? req.user.emails[0].value : "faculty@gmail.com";

        const db = mongoose.connection.useDb('attendance_db');
        
        // Update the document based on employeeId or insert a new record if it's unique
        await db.collection('attendances').updateOne(
            { employeeId: employeeId || "FAC-001" },
            {
                $set: {
                    name: userName,
                    email: userEmail,
                    room: location || "101", // Maps 'location' from frontend to your 'room' dataset
                    status: status || "In Class",
                    gps: gps || {},
                    lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                }
            },
            { upsert: true }
        );

        console.log(`📡 MongoDB Synchronized: ${userName} status changed to [${status}] in Room ${location}`);
        return res.json({ success: true, message: "Attendance synchronized with MongoDB cluster!" });

    } catch (err) {
        console.error("❌ MongoDB Write Error:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});


// ==========================================
// 7. SERVER INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 5050;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVER ACTIVE & LIVE ON PORT: ${PORT}`);
});