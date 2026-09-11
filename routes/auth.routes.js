const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Login and initial landing routes
router.get(['/', '/login', '/signin', '/signup'], authController.showLoginPage);

// Login and initial verification check (Student & Faculty)
router.post('/login', authController.handleLogin);

// Faculty Password Verification
router.post('/verify-teacher', authController.verifyTeacherPassword);

// Faculty Dashboard Route
router.get('/teacher/dashboard', authController.getTeacherDashboard);

// API: Student Submits NOC Application (Stores in Verification.Requested_Student)
router.post('/api/student/apply-noc', authController.submitStudentNoc);

// API: Student Live Status Check from MongoDB
router.get('/api/student/status', authController.getStudentStatus);

// API: Stream Student Uploaded Document as Inline PDF in New Tab
router.get('/api/view-document', authController.viewDocument);

// API: Faculty Approves Student NOC (Moves to Verification.Approved_Student)
router.post('/api/teacher/approve-student', authController.approveStudentNoc);

// API: Faculty Bulk Approves Students
router.post('/api/teacher/bulk-approve-students', authController.bulkApproveStudents);

// API: Faculty Revokes / Disapproves Student NOC (Moves back to Requested_Student)
router.post('/api/teacher/revoke-student', authController.revokeStudentNoc);

// Student Password Management APIs
router.post('/api/student/send-password-otp', authController.sendStudentPasswordOtp);
router.post('/api/student/reset-password', authController.resetStudentPassword);

// Legacy redirect
router.post('/verify-enrollment', (req, res) => {
    res.redirect(307, '/login');
});

module.exports = router;
