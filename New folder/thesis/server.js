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
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("⚠️ WARNING: Google OAuth environment variables are missing! Login will fail.");
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || "DUMMY_ID_FOR_COMPILATION",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "DUMMY_SECRET_FOR_COMPILATION",
    callbackURL: "https://thesis-attendance-1.onrender.com/auth/google/callback",
    proxy: true // 👈 CRITICAL: Tells Passport to trust Render's secure HTTPS proxy wrapper
},
async (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));


// ==========================================
// 4. DATABASE CONNECTION
// ==========================================
const dbURI = process.env.MONGODB_URI || "mongodb+srv://Gaius:GaiusThesis2026@thesiscluster.9em3kfg.mongodb.net/attendance_db?retryWrites=true&w=majority";

console.log("📡 Attempting Database Connection...");
mongoose.connect(dbURI, {
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

// 1. GET USER INFO ROUTE
app.get('/user-info', (req, res) => {
    if (req.user && req.user.emails) {
        return res.json({
            authenticated: true,
            email: req.user.emails[0].value,
            name: req.user.displayName || "Faculty Member"
        });
    }
    return res.json({
        authenticated: false,
        email: "guest.faculty@gmail.com",
        name: "Guest Faculty"
    });
});

// 2. RETRIEVE ALL RECORDED ATTENDANCES (Fixed: Removed accidental deleteMany loop)
app.get('/get-attendance', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: "Database offline" });
        }
        const records = await mongoose.connection.db.collection('attendances').find().toArray();
        return res.json(records);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 3. POST STATUS UPDATE ROUTE
app.post('/record-attendance', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ success: false, error: "Database offline. Try again shortly." });
        }

        const { employeeId, location, status, gps } = req.body;
        const userName = req.user && req.user.displayName ? req.user.displayName : `Faculty ${employeeId || 'FAC-001'}`;
        const userEmail = req.user && req.user.emails ? req.user.emails[0].value : "faculty@gmail.com";

        await mongoose.connection.db.collection('attendances').updateOne(
            { employeeId: employeeId || "FAC-001" },
            {
                $set: {
                    name: userName,
                    email: userEmail,
                    room: location || "101", 
                    status: status || "In Class",
                    gps: gps || {},
                    lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                }
            },
            { upsert: true }
        );

        console.log(`📡 MongoDB Synchronized: ${userName} -> ${location}`);
        return res.json({ success: true, message: "Attendance synchronized!" });

    } catch (err) {
        console.error("❌ MongoDB Write Error:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// 4. CLEAR ALL RECORDS ROUTE (Clean, dedicated endpoint)
app.delete('/clear-attendance', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ success: false, error: "Database offline." });
        }

        await mongoose.connection.db.collection('attendances').deleteMany({});
        console.log("🧹 Dashboard logs cleared by Chairperson.");
        return res.json({ success: true, message: "All attendance records cleared successfully!" });

    } catch (err) {
        console.error("❌ Failed to clear logs:", err.message);
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