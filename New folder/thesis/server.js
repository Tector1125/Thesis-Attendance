// ==========================================
// 1. FRONTEND STATIC FILE & ROUTING CONFIG (BULLETPROOF PATHS)
// ==========================================

// This dynamically determines if 'public' is next to server.js or one level up
const publicPath = fs.existsSync(path.join(__dirname, 'public')) 
    ? path.join(__dirname, 'public') 
    : path.join(__dirname, '..', '..', 'public');

console.log(`📂 Static assets route locked onto: ${publicPath}`);

app.use(express.static(publicPath));

// Fix the login route path
app.get('/login-page', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
});

// Fix the dashboard route path
app.get('/dashboard', (req, res) => {
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
// Prioritizes the environment variable from Render dashboard first
const dbURI = process.env.MONGODB_URI || "mongodb+srv://Gaius:hyukkwonhyukkwon11@thesiscluster.xxxx.mongodb.net/attendance_db?retryWrites=true&w=majority";

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
        res.redirect('/dashboard'); 
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