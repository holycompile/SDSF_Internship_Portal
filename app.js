require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./libs/database');
const authRoutes = require('./routes/auth.routes');

// Disable Express fingerprinting header for security
app.disable('x-powered-by');

// Connect to MongoDB
connectDB().catch(err => console.error("Initial MongoDB connection attempt failed:", err.message));

// Middleware to ensure DB connection before request handling (essential for serverless Vercel)
app.use(async (req, res, next) => {
    try {
        await connectDB();
    } catch (e) {
        console.error("Database connection middleware error:", e.message);
    }
    next();
});

// Setting EJS as the view engine & pointing to views and public directories
app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'public')
]);

// Serving static assets
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/tailwind', express.static(path.join(__dirname, 'tailwind')));
app.use('/docs', express.static(path.join(__dirname, 'docs')));
app.use('/docs_dynamic', express.static(path.join(__dirname, 'docs_dynamic')));
app.use('/photoes', express.static(path.join(__dirname, 'public/photoes')));
app.use('/photoes', express.static(path.join(__dirname, '../photoes')));
app.use('/site_style.css', (req, res) => {
    const localStyle = path.join(__dirname, 'public/style.css');
    const parentStyle = path.join(__dirname, '../style.css');
    if (fs.existsSync(parentStyle)) return res.sendFile(parentStyle);
    if (fs.existsSync(localStyle)) return res.sendFile(localStyle);
    res.status(404).render('404_Error/404_error');
});

// Body parsing middlewares (allow up to 50mb for multi-document PDF uploads)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// Application Routes
app.use('/', authRoutes);

// Global Error Handler (Prevents crashes and returns friendly UI)
app.use((err, req, res, next) => {
    console.error('Unhandled Application Error:', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).render('log_in_page_folder/log_in_page', {
        error: 'A server error occurred. Please try again later.',
        enteredEnrollment: ''
    });
});

// 404 Catch-all handler
app.use((req, res) => {
    res.status(404).render('404_Error/404_error');
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, (err) => {
        if (err) {
            console.error("Error occurred while starting server:", err);
        } else {
            console.log(`Server running at http://localhost:${PORT}`);
        }
    });
}

module.exports = app;
