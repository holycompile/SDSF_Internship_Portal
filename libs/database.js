const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Ensure Node resolves MongoDB Atlas SRV records properly on Windows / local networks
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
    // Ignore if not supported in certain serverless environments
}

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const ADMIN_DB = process.env.ADMIN_DB_NAME || 'SDSF_Admin';
const STUDENTS_DB = process.env.STUDENTS_DB_NAME || 'Students';
const VERIFICATION_DB = process.env.VERIFICATION_DB_NAME || 'Verification';

let isConnected = false;
let studentsDb = null;
let verificationDb = null;
let adminDb = null;

const connectDB = async () => {
    if (isConnected || mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    try {
        const conn = await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        console.log(`Successfully connected to MongoDB server at ${conn.connection.host}`);
        
        studentsDb = mongoose.connection.useDb(STUDENTS_DB, { useCache: true });
        verificationDb = mongoose.connection.useDb(VERIFICATION_DB, { useCache: true });
        adminDb = mongoose.connection.useDb(ADMIN_DB, { useCache: true });
        
        return conn;
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        // Don't crash process in serverless; allow re-attempt on next request
        return null;
    }
};

const getStudentsDb = () => {
    if (!studentsDb || mongoose.connection.readyState !== 1) {
        studentsDb = mongoose.connection.useDb(STUDENTS_DB, { useCache: true });
    }
    return studentsDb;
};

const getVerificationDb = () => {
    if (!verificationDb || mongoose.connection.readyState !== 1) {
        verificationDb = mongoose.connection.useDb(VERIFICATION_DB, { useCache: true });
    }
    return verificationDb;
};

const getAdminDb = () => {
    if (!adminDb || mongoose.connection.readyState !== 1) {
        adminDb = mongoose.connection.useDb(ADMIN_DB, { useCache: true });
    }
    return adminDb;
};

module.exports = {
    connectDB,
    getStudentsDb,
    getVerificationDb,
    getAdminDb,
    mongoose
};
