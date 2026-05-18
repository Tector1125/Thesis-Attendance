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

// 👈 ADD THIS NEW POST ROUTE RIGHT HERE:
app.post('/update-status', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: "Database is offline. Try again shortly." });
        }

        // Grab data sent from scan.html front-end form
        const { room, status } = req.body;
        
        // Safety check to ensure data exists
        if (!room || !status) {
            return res.status(400).json({ error: "Missing room or status values." });
        }

        // Fallback email identity if passport session is still building out
        const userEmail = req.user && req.user.emails ? req.user.emails[0].value : "test.faculty@gmail.com";
        const userName = req.user && req.user.displayName ? req.user.displayName : "Faculty Member";

        const db = mongoose.connection.useDb('attendance_db');
        
        // Update the record if it exists for this email, or create a new one (upsert)
        await db.collection('attendances').updateOne(
            { email: userEmail },
            { 
                $set: { 
                    name: userName,
                    room: room, 
                    status: status, 
                    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    location: "Detected via Scanner"
                } 
            },
            { upsert: true }
        );

        console.log(`📝 Status updated for ${userEmail}: Room ${room} - ${status}`);
        res.json({ success: true, message: "Status updated successfully!" });

    } catch (err) {
        console.error("❌ Status Update Failed:", err.message);
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