const bcrypt = require('bcrypt');
const { getStudentsDb, getVerificationDb, getAdminDb } = require('../libs/database');
const { sendVerificationEmail } = require('../middleware/emailConfig');

/**
 * Helper to escape special regex characters from user input to prevent regex injection / ReDoS
 */
const escapeRegex = (str) => (str || '').toString().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Helper to mask an email address for privacy (e.g. j***s@gmail.com)
 */
function maskEmail(email) {
    if (!email || !email.includes('@')) return email || '';
    const [user, domain] = email.split('@');
    if (user.length <= 2) return `${user[0]}*@${domain}`;
    return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * Helper function to search for a student across all course collections in the Students database
 */
async function searchStudentInAllCollections(enrollmentNo) {
    if (!enrollmentNo || !enrollmentNo.trim()) return null;
    const cleanEnrollment = enrollmentNo.trim();
    const regex = new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i');

    try {
        const studentsDb = getStudentsDb();
        const collections = await studentsDb.db.listCollections().toArray();

        for (const col of collections) {
            if (col.name.startsWith('system.')) continue;

            const studentDoc = await studentsDb.collection(col.name).findOne({
                $or: [
                    { enrollmentNo: regex },
                    { enrollment_no: regex },
                    { EnrollmentNo: regex },
                    { "Enrollment No": regex },
                    { "Enrollment No.": regex },
                    { rollNo: regex },
                    { roll_no: regex }
                ]
            });

            if (studentDoc) {
                return {
                    raw: studentDoc,
                    studentName: studentDoc.studentName || studentDoc.name || studentDoc.StudentName || 'Student',
                    enrollmentNo: studentDoc.enrollmentNo || studentDoc.enrollment_no || cleanEnrollment.toUpperCase(),
                    course: studentDoc.course || col.name.replace(/_/g, ' '),
                    email: studentDoc.email || studentDoc.Email || studentDoc.studentEmail || studentDoc["Email ID"] || studentDoc["Email Address"] || studentDoc.mail || studentDoc.EMAIL || '',
                    NOC: studentDoc.NOC,
                    letterOfApproval: studentDoc.letterOfApproval,
                    collectionName: col.name
                };
            }
        }
    } catch (err) {
        console.error('Error querying Students collections:', err);
    }
    return null;
}

/**
 * Generate a random 6-digit numeric verification code
 */
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Upsert student record and verification code into Verification DB -> Verified_Student collection
 */
async function saveToVerifiedStudent(studentInfo, verificationCode) {
    try {
        const verificationDb = getVerificationDb();
        const verifiedCollection = verificationDb.collection('Verified_Student');

        const studentData = {
            ...studentInfo.raw,
            studentName: studentInfo.studentName,
            enrollmentNo: studentInfo.enrollmentNo,
            email: studentInfo.email,
            course: studentInfo.course,
            NOC: studentInfo.NOC,
            letterOfApproval: studentInfo.letterOfApproval,
            originalCollection: studentInfo.collectionName,
            verificationCode: verificationCode,
            updatedAt: new Date()
        };

        delete studentData._id;

        const result = await verifiedCollection.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(studentInfo.enrollmentNo)}$`, 'i') },
            { 
                $set: studentData,
                $setOnInsert: { createdAt: new Date(), isApproved: false }
            },
            { upsert: true }
        );

        console.log(`Saved student record [${studentInfo.enrollmentNo}] with verification code to Verification.Verified_Student.`);
        return { success: true, result, verificationCode };
    } catch (err) {
        console.error('Error saving to Verification.Verified_Student:', err);
        throw err;
    }
}

/**
 * Render the main login page
 */
const showLoginPage = (req, res) => {
    res.render('log_in_page_folder/log_in_page', {
        error: null,
        enteredEnrollment: ''
    });
};

/**
 * Handle Login Submission & Verification
 */
const handleLogin = async (req, res) => {
    const { role, studentId, teacherId, studentName, enrollmentNo, email } = req.body;

    // 1. Direct Faculty Login against admin.Teachers collection
    if (role === 'teacher') {
        const targetFaculty = (teacherId || '').trim();
        const enteredPassword = (req.body.password || '').trim();
        console.log(`Authenticating Faculty: "${targetFaculty}"`);

        if (!targetFaculty || !enteredPassword) {
            return res.render('log_in_page_folder/log_in_page', {
                error: 'Please enter both Faculty ID and Password.',
                enteredEnrollment: ''
            });
        }

        try {
            const adminDb = getAdminDb();
            const teacherDoc = await adminDb.collection('Teachers').findOne({
                facultyId: new RegExp(`^${escapeRegex(targetFaculty)}$`, 'i'),
                password: enteredPassword
            });

            if (teacherDoc) {
                console.log(`[Faculty Login Successful] Welcome ${teacherDoc.facultyId}`);
                // Query all 3 Verification collections directly
                const verificationDb = getVerificationDb();
                const verifiedStudents = await verificationDb.collection('Verified_Student').find().sort({ verifiedAt: -1, updatedAt: -1 }).toArray();
                const requestedStudents = await verificationDb.collection('Requested_Student').find().sort({ submittedAt: -1 }).toArray();
                const approvedStudents = await verificationDb.collection('Approved_Student').find().sort({ approvedAt: -1 }).toArray();

                return res.render('verified_teacher/teacher_index', {
                    facultyId: teacherDoc.facultyId,
                    verifiedStudents,
                    requestedStudents,
                    approvedStudents
                });
            } else {
                console.log(`[Faculty Login Failed] Invalid Faculty ID or Password for "${targetFaculty}"`);
                return res.render('log_in_page_folder/log_in_page', {
                    error: 'Invalid Faculty ID or Password. Please check your credentials and try again.',
                    enteredEnrollment: ''
                });
            }
        } catch (err) {
            console.error('Error querying admin.Teachers:', err);
            return res.render('log_in_page_folder/log_in_page', {
                error: 'A database error occurred during faculty login.',
                enteredEnrollment: ''
            });
        }
    }

    // 2. Verified Student Proceeding to Portal - Verify Entered Code
    if (role === 'student_verified') {
        const targetEnrollment = (enrollmentNo || '').trim();
        const enteredCode = (req.body.verificationCode || '').trim();

        if (!targetEnrollment) {
            return res.redirect('/login');
        }

        try {
            const verificationDb = getVerificationDb();
            const verifiedCollection = verificationDb.collection('Verified_Student');

            const verifiedRecord = await verifiedCollection.findOne({
                enrollmentNo: new RegExp(`^${escapeRegex(targetEnrollment)}$`, 'i')
            });

            if (!verifiedRecord || !verifiedRecord.verificationCode) {
                return res.render('verification_folder/verify_enrollment', {
                    student: {
                        studentName,
                        enrollmentNo: targetEnrollment,
                        course: req.body.course,
                        email
                    },
                    error: 'Verification session has expired or no record found. Please restart from login.'
                });
            }

            // Check if entered code matches the code in the database
            if (verifiedRecord.verificationCode.toString().trim() !== enteredCode) {
                console.log(`[Verification Failed] Entered code (${enteredCode}) does not match DB code (${verifiedRecord.verificationCode}) for ${targetEnrollment}`);
                return res.render('verification_folder/verify_enrollment', {
                    student: {
                        studentName: verifiedRecord.studentName || studentName,
                        enrollmentNo: verifiedRecord.enrollmentNo || targetEnrollment,
                        course: verifiedRecord.course || req.body.course,
                        email: verifiedRecord.email || email
                    },
                    error: 'The verification code you entered is incorrect. Please check your email and try again.'
                });
            }

            // Code is verified successfully!
            console.log(`[Verification Successful] Student ${targetEnrollment} verified successfully!`);
            await verifiedCollection.updateOne(
                { _id: verifiedRecord._id },
                { $set: { isVerified: true, verifiedAt: new Date() } }
            );

            const approvedRecord = await verificationDb.collection('Approved_Student').findOne({
                enrollmentNo: new RegExp(`^${escapeRegex(targetEnrollment)}$`, 'i')
            });
            const requestedRecord = await verificationDb.collection('Requested_Student').findOne({
                enrollmentNo: new RegExp(`^${escapeRegex(targetEnrollment)}$`, 'i')
            });
            const previousSubmission = await verificationDb.collection('Students_Previous_Submissions').findOne({
                enrollmentNo: new RegExp(`^${escapeRegex(targetEnrollment)}$`, 'i')
            });

            const activeApplication = approvedRecord ? { ...approvedRecord, status: 'Approved' }
                                    : (requestedRecord ? { ...requestedRecord, status: 'Pending Approval' } : null);

            // Render Student Portal Dashboard
            return res.render('student_verified/student_index', {
                student: {
                    ...verifiedRecord,
                    ...req.body,
                    studentName: verifiedRecord.studentName || studentName,
                    enrollmentNo: verifiedRecord.enrollmentNo || targetEnrollment,
                    course: verifiedRecord.course || req.body.course,
                    email: verifiedRecord.email || email
                },
                activeApplication,
                previousSubmission: previousSubmission || null
            });
        } catch (err) {
            console.error('Error verifying code:', err);
            return res.render('verification_folder/verify_enrollment', {
                student: {
                    studentName,
                    enrollmentNo: targetEnrollment,
                    course: req.body.course,
                    email
                },
                error: 'An internal error occurred during verification. Please try again.'
            });
        }
    }

    // 3. Student Login - Authenticate using Enrollment Number + Password
    const targetEnrollment = (enrollmentNo || studentId || '').trim();
    const enteredPassword = (req.body.password || '').trim();
    console.log(`Authenticating Student: "${targetEnrollment}"`);

    if (!targetEnrollment || !enteredPassword) {
        return res.render('log_in_page_folder/log_in_page', {
            error: !targetEnrollment ? 'Please enter your Enrollment Number.' : 'Please enter your Password.',
            enteredEnrollment: targetEnrollment
        });
    }

    try {
        const studentInfo = await searchStudentInAllCollections(targetEnrollment);
        const verificationDb = getVerificationDb();
        const verifiedCollection = verificationDb.collection('Verified_Student');

        const verifiedRecord = await verifiedCollection.findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(targetEnrollment)}$`, 'i')
        });

        if (!studentInfo && !verifiedRecord) {
            console.log(`Enrollment number "${targetEnrollment}" not found in student records.`);
            return res.render('log_in_page_folder/log_in_page', {
                error: `Enrollment number "${targetEnrollment}" was not found in SDSF student records. Please check and try again.`,
                enteredEnrollment: targetEnrollment
            });
        }

        const effectiveStudent = studentInfo || {
            raw: verifiedRecord,
            studentName: verifiedRecord.studentName || 'Student',
            enrollmentNo: verifiedRecord.enrollmentNo || targetEnrollment.toUpperCase(),
            course: verifiedRecord.course || '',
            email: verifiedRecord.email || '',
            collectionName: verifiedRecord.originalCollection || ''
        };

        // Determine student's password from Verified_Student or Student collection
        const existingHashedPassword = (verifiedRecord && verifiedRecord.password) || (effectiveStudent.raw && effectiveStudent.raw.password);

        let passwordValid = false;

        if (existingHashedPassword) {
            passwordValid = await bcrypt.compare(enteredPassword, existingHashedPassword);
        } else {
            // First-time login: Default password is SDSF@1
            if (enteredPassword === 'SDSF@1') {
                passwordValid = true;
                // Automatically hash SDSF@1 and save it to the DB so future logins are securely hashed
                const initialHashedPassword = await bcrypt.hash('SDSF@1', 10);

                await verifiedCollection.updateOne(
                    { enrollmentNo: new RegExp(`^${escapeRegex(effectiveStudent.enrollmentNo)}$`, 'i') },
                    { $set: { password: initialHashedPassword, updatedAt: new Date() } }
                );

                if (effectiveStudent.collectionName) {
                    try {
                        const studentsDb = getStudentsDb();
                        await studentsDb.collection(effectiveStudent.collectionName).updateOne(
                            {
                                $or: [
                                    { enrollmentNo: new RegExp(`^${escapeRegex(effectiveStudent.enrollmentNo)}$`, 'i') },
                                    { enrollment_no: new RegExp(`^${escapeRegex(effectiveStudent.enrollmentNo)}$`, 'i') }
                                ]
                            },
                            { $set: { password: initialHashedPassword } }
                        );
                    } catch (e) {
                        console.error('Error saving initial hashed password to course collection:', e);
                    }
                }
            } else {
                return res.render('log_in_page_folder/log_in_page', {
                    error: 'Invalid password. If this is your first time logging in, please use the default password "SDSF@1" or reset your password using Forgot Password.',
                    enteredEnrollment: targetEnrollment
                });
            }
        }

        if (!passwordValid) {
            console.log(`[Student Login Failed] Invalid password for student "${targetEnrollment}"`);
            return res.render('log_in_page_folder/log_in_page', {
                error: 'Invalid password. Please check your credentials or reset your password using Forgot Password.',
                enteredEnrollment: targetEnrollment
            });
        }

        console.log(`[Student Login Successful] Student ${effectiveStudent.enrollmentNo} (${effectiveStudent.studentName}) logged in.`);

        // Ensure student is saved in Verified_Student with isVerified: true
        const studentDataToSave = {
            ...(effectiveStudent.raw || {}),
            studentName: effectiveStudent.studentName,
            enrollmentNo: effectiveStudent.enrollmentNo,
            course: effectiveStudent.course,
            email: effectiveStudent.email,
            originalCollection: effectiveStudent.collectionName,
            isVerified: true,
            verifiedAt: new Date(),
            updatedAt: new Date()
        };
        delete studentDataToSave._id;
        delete studentDataToSave.verificationCode;
        if (!studentDataToSave.password && existingHashedPassword) {
            studentDataToSave.password = existingHashedPassword;
        }

        await verifiedCollection.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(effectiveStudent.enrollmentNo)}$`, 'i') },
            {
                $set: studentDataToSave,
                $setOnInsert: { createdAt: new Date(), isApproved: false }
            },
            { upsert: true }
        );

        // Fetch application states for dashboard
        const approvedRecord = await verificationDb.collection('Approved_Student').findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(effectiveStudent.enrollmentNo)}$`, 'i')
        });
        const requestedRecord = await verificationDb.collection('Requested_Student').findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(effectiveStudent.enrollmentNo)}$`, 'i')
        });
        const previousSubmission = await verificationDb.collection('Students_Previous_Submissions').findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(effectiveStudent.enrollmentNo)}$`, 'i')
        });

        const activeApplication = approvedRecord ? { ...approvedRecord, status: 'Approved' }
                                : (requestedRecord ? { ...requestedRecord, status: 'Pending Approval' } : null);

        // Render Student Portal Dashboard directly without OTP!
        return res.render('student_verified/student_index', {
            student: {
                ...(verifiedRecord || {}),
                ...effectiveStudent,
                studentName: effectiveStudent.studentName,
                enrollmentNo: effectiveStudent.enrollmentNo,
                course: effectiveStudent.course,
                email: effectiveStudent.email
            },
            activeApplication,
            previousSubmission: previousSubmission || null
        });
    } catch (err) {
        console.error('Error during student login verification:', err);
        return res.render('log_in_page_folder/log_in_page', {
            error: 'A database error occurred while verifying student credentials. Please try again.',
            enteredEnrollment: targetEnrollment
        });
    }
};

/**
 * Handle Faculty Password Verification and render Teacher Dashboard
 */
const verifyTeacherPassword = async (req, res) => {
    const { facultyId, password } = req.body;
    const targetFaculty = (facultyId || '').trim();
    const enteredPassword = (password || '').trim();

    try {
        const adminDb = getAdminDb();
        const teacherDoc = await adminDb.collection('Teachers').findOne({
            facultyId: new RegExp(`^${escapeRegex(targetFaculty)}$`, 'i'),
            password: enteredPassword
        });

        if (!teacherDoc) {
            console.log(`[Teacher Auth Failed] Invalid password for faculty "${targetFaculty}"`);
            return res.render('verification_folder/verify_teacher', {
                facultyId: targetFaculty,
                error: 'Invalid password. Please check and try again.'
            });
        }

        console.log(`[Teacher Auth Success] Faculty "${targetFaculty}" logged in.`);
        
        // Fetch data from all 3 Verification collections
        const verificationDb = getVerificationDb();
        const verifiedStudents = await verificationDb.collection('Verified_Student').find().sort({ verifiedAt: -1, updatedAt: -1 }).toArray();
        const requestedStudents = await verificationDb.collection('Requested_Student').find().sort({ submittedAt: -1 }).toArray();
        const approvedStudents = await verificationDb.collection('Approved_Student').find().sort({ approvedAt: -1 }).toArray();

        return res.render('verified_teacher/teacher_index', {
            facultyId: teacherDoc.facultyId,
            verifiedStudents,
            requestedStudents,
            approvedStudents
        });
    } catch (err) {
        console.error('Error in verifyTeacherPassword:', err);
        return res.render('verification_folder/verify_teacher', {
            facultyId: targetFaculty,
            error: 'A database error occurred while verifying faculty.'
        });
    }
};

/**
 * Teacher Dashboard Direct GET route
 */
const getTeacherDashboard = async (req, res) => {
    try {
        const verificationDb = getVerificationDb();
        const verifiedStudents = await verificationDb.collection('Verified_Student').find().sort({ verifiedAt: -1, updatedAt: -1 }).toArray();
        const requestedStudents = await verificationDb.collection('Requested_Student').find().sort({ submittedAt: -1 }).toArray();
        const approvedStudents = await verificationDb.collection('Approved_Student').find().sort({ approvedAt: -1 }).toArray();

        return res.render('verified_teacher/teacher_index', {
            facultyId: 'SDSF Faculty',
            verifiedStudents,
            requestedStudents,
            approvedStudents
        });
    } catch (err) {
        console.error('Error fetching teacher dashboard:', err);
        res.status(500).send('Database error fetching dashboard.');
    }
};

/**
 * API: Student Submits NOC Application -> Saved to Verification.Requested_Student
 */
const submitStudentNoc = async (req, res) => {
    const { studentName, enrollmentNo, course, semester, companyName, internshipMode, docName } = req.body;
    const cleanEnrollment = (enrollmentNo || '').trim();

    if (!cleanEnrollment) {
        return res.status(400).json({ success: false, message: 'Enrollment number is required.' });
    }

    try {
        const verificationDb = getVerificationDb();
        const requestedCol = verificationDb.collection('Requested_Student');

        const rawDocs = Array.isArray(req.body.documents) && req.body.documents.length > 0
            ? req.body.documents
            : (req.body.fileDataUrl ? [{ docName: docName || 'Offer_Document.pdf', fileDataUrl: req.body.fileDataUrl, label: 'Offer Document' }] : []);

        const applicationData = {
            studentName: studentName || 'Student',
            enrollmentNo: cleanEnrollment.toUpperCase(),
            course: course || '',
            semester: semester || 'Sem X',
            companyName: companyName || '',
            internshipMode: internshipMode || 'Off Campus',
            docName: (rawDocs[0] && rawDocs[0].docName) || docName || 'Offer_Document.pdf',
            fileDataUrl: (rawDocs[0] && rawDocs[0].fileDataUrl) || req.body.fileDataUrl || '',
            documents: rawDocs,
            status: 'Pending Approval',
            submittedAt: new Date()
        };

        await requestedCol.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
            { $set: applicationData },
            { upsert: true }
        );

        // Also store a copy into Verification.Students_Previous_Submissions
        const prevSubmissionsCol = verificationDb.collection('Students_Previous_Submissions');
        await prevSubmissionsCol.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
            { $set: { ...applicationData, savedAt: new Date() } },
            { upsert: true }
        );

        console.log(`[NOC Application] Saved application for student [${cleanEnrollment}] to Verification.Requested_Student and Verification.Students_Previous_Submissions.`);
        return res.json({ success: true, message: 'NOC Application submitted successfully!', application: applicationData });
    } catch (err) {
        console.error('Error in submitStudentNoc:', err);
        return res.status(500).json({ success: false, message: 'Failed to submit NOC application.' });
    }
};

/**
 * API: Teacher Approves Student NOC -> Moves to Verification.Approved_Student
 */
const approveStudentNoc = async (req, res) => {
    const { enrollmentNo } = req.body;
    const cleanEnrollment = (enrollmentNo || '').trim();

    if (!cleanEnrollment) {
        return res.status(400).json({ success: false, message: 'Enrollment number is required.' });
    }

    try {
        const verificationDb = getVerificationDb();
        const requestedCol = verificationDb.collection('Requested_Student');
        const approvedCol = verificationDb.collection('Approved_Student');
        const verifiedCol = verificationDb.collection('Verified_Student');

        // 1. Find the application in Requested_Student or Verified_Student
        let record = await requestedCol.findOne({ enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') });
        if (!record) {
            record = await verifiedCol.findOne({ enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') });
        }

        if (!record) {
            return res.status(404).json({ success: false, message: 'Student record not found.' });
        }

        const approvedData = {
            ...record,
            status: 'Approved',
            approvedAt: new Date()
        };
        delete approvedData._id;

        // 2. Insert into Approved_Student
        await approvedCol.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
            { $set: approvedData },
            { upsert: true }
        );

        // 3. Sync Approved status into Students_Previous_Submissions
        const prevSubmissionsCol = verificationDb.collection('Students_Previous_Submissions');
        await prevSubmissionsCol.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
            { $set: { ...approvedData, isApproved: true, status: 'Approved', approvedAt: new Date() } },
            { upsert: true }
        );

        // 4. Remove from Requested_Student
        await requestedCol.deleteOne({ enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') });

        // 5. Update isApproved in Verified_Student
        await verifiedCol.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
            { $set: { isApproved: true, approvedAt: new Date() } }
        );

        console.log(`[Approval Successful] Student [${cleanEnrollment}] moved to Verification.Approved_Student and synced to Students_Previous_Submissions.`);
        return res.json({ success: true, message: `Student ${cleanEnrollment} approved successfully!` });
    } catch (err) {
        console.error('Error approving student NOC:', err);
        return res.status(500).json({ success: false, message: 'Failed to approve student NOC.' });
    }
};

/**
 * API: Teacher Revokes / Disapproves Student NOC -> Moves back from Approved_Student to Requested_Student
 */
const revokeStudentNoc = async (req, res) => {
    const { enrollmentNo } = req.body;
    const cleanEnrollment = (enrollmentNo || '').trim();

    if (!cleanEnrollment) {
        return res.status(400).json({ success: false, message: 'Enrollment number is required.' });
    }

    try {
        const verificationDb = getVerificationDb();
        const requestedCol = verificationDb.collection('Requested_Student');
        const approvedCol = verificationDb.collection('Approved_Student');
        const verifiedCol = verificationDb.collection('Verified_Student');
        const prevSubmissionsCol = verificationDb.collection('Students_Previous_Submissions');

        const record = await approvedCol.findOne({ enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') });
        if (!record) {
            return res.status(404).json({ success: false, message: 'Approved student record not found.' });
        }

        const pendingData = {
            ...record,
            status: 'Pending Approval',
            revertedAt: new Date()
        };
        delete pendingData._id;
        delete pendingData.approvedAt;

        // 1. Move back to Requested_Student
        await requestedCol.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
            { $set: pendingData },
            { upsert: true }
        );

        // 2. Sync Reverted status into Students_Previous_Submissions
        await prevSubmissionsCol.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
            { $set: { ...pendingData, isApproved: false, status: 'Pending Approval' }, $unset: { approvedAt: '' } },
            { upsert: true }
        );

        // 3. Remove from Approved_Student
        await approvedCol.deleteOne({ enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') });

        // 4. Mark isApproved: false in Verified_Student
        await verifiedCol.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
            { $set: { isApproved: false }, $unset: { approvedAt: '' } }
        );

        console.log(`[Revoke Successful] Student [${cleanEnrollment}] moved back to Verification.Requested_Student and synced to Students_Previous_Submissions.`);
        return res.json({ success: true, message: `Student ${cleanEnrollment} approval has been revoked and moved back to Requested NOCs.` });
    } catch (err) {
        console.error('Error revoking student NOC:', err);
        return res.status(500).json({ success: false, message: 'Failed to revoke student approval.' });
    }
};

/**
 * API: Get live student application & NOC status from MongoDB
 */
const getStudentStatus = async (req, res) => {
    const cleanEnrollment = (req.query.enrollmentNo || req.query.enrollment || '').trim();

    if (!cleanEnrollment) {
        return res.status(400).json({ success: false, message: 'Enrollment number is required.' });
    }

    try {
        const verificationDb = getVerificationDb();
        
        // 1. Check Approved_Student
        const approvedRecord = await verificationDb.collection('Approved_Student').findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i')
        });

        const previousRecord = await verificationDb.collection('Students_Previous_Submissions').findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i')
        });

        if (approvedRecord) {
            return res.json({
                success: true,
                status: 'Approved',
                isApproved: true,
                application: approvedRecord,
                previousSubmission: previousRecord || null
            });
        }

        // 2. Check Requested_Student
        const requestedRecord = await verificationDb.collection('Requested_Student').findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i')
        });

        if (requestedRecord) {
            return res.json({
                success: true,
                status: 'Pending Approval',
                isApproved: false,
                application: requestedRecord,
                previousSubmission: previousRecord || null
            });
        }

        // 3. Check Verified_Student
        const verifiedRecord = await verificationDb.collection('Verified_Student').findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i')
        });

        if (verifiedRecord) {
            delete verifiedRecord.verificationCode;
            return res.json({
                success: true,
                status: verifiedRecord.isApproved ? 'Approved' : 'Not Applied',
                isApproved: !!verifiedRecord.isApproved,
                application: verifiedRecord,
                previousSubmission: previousRecord || null
            });
        }

        return res.json({
            success: false,
            status: 'Not Found',
            isApproved: false,
            application: null,
            previousSubmission: previousRecord || null
        });
    } catch (err) {
        console.error('Error fetching student status:', err);
        return res.status(500).json({ success: false, message: 'Database error fetching status.' });
    }
};

/**
 * API: Teacher Bulk Approves Multiple Students
 */
const bulkApproveStudents = async (req, res) => {
    const { enrollmentNos } = req.body;
    if (!Array.isArray(enrollmentNos) || enrollmentNos.length === 0) {
        return res.status(400).json({ success: false, message: 'Please provide an array of enrollment numbers.' });
    }

    try {
        const verificationDb = getVerificationDb();
        const requestedCol = verificationDb.collection('Requested_Student');
        const approvedCol = verificationDb.collection('Approved_Student');
        const verifiedCol = verificationDb.collection('Verified_Student');

        const prevSubmissionsCol = verificationDb.collection('Students_Previous_Submissions');
        let approvedCount = 0;

        for (const rawEnrollment of enrollmentNos) {
            const cleanEnrollment = (rawEnrollment || '').trim();
            if (!cleanEnrollment) continue;

            let record = await requestedCol.findOne({ enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') });
            if (!record) {
                record = await verifiedCol.findOne({ enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') });
            }

            if (record) {
                const approvedData = {
                    ...record,
                    status: 'Approved',
                    approvedAt: new Date()
                };
                delete approvedData._id;

                await approvedCol.updateOne(
                    { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
                    { $set: approvedData },
                    { upsert: true }
                );

                // Sync to Students_Previous_Submissions
                await prevSubmissionsCol.updateOne(
                    { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
                    { $set: { ...approvedData, isApproved: true, status: 'Approved', approvedAt: new Date() } },
                    { upsert: true }
                );

                await requestedCol.deleteOne({ enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') });

                await verifiedCol.updateOne(
                    { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
                    { $set: { isApproved: true, approvedAt: new Date() } }
                );

                approvedCount++;
            }
        }

        console.log(`[Bulk Approval Successful] ${approvedCount} students approved successfully.`);
        return res.json({ success: true, count: approvedCount, message: `Successfully approved ${approvedCount} student(s)!` });
    } catch (err) {
        console.error('Error in bulkApproveStudents:', err);
        return res.status(500).json({ success: false, message: 'Failed to bulk approve students.' });
    }
};

/**
 * API: Stream Student Uploaded Document as Inline PDF in New Tab
 */
const viewDocument = async (req, res) => {
    const { enrollment, docIndex } = req.query;
    const cleanEnrollment = (enrollment || '').trim();
    const idx = parseInt(docIndex, 10) || 0;

    if (!cleanEnrollment) {
        return res.status(400).send('Enrollment number is required.');
    }

    try {
        const verificationDb = getVerificationDb();
        let record = await verificationDb.collection('Requested_Student').findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i')
        });

        if (!record) {
            record = await verificationDb.collection('Approved_Student').findOne({
                enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i')
            });
        }

        if (!record) {
            record = await verificationDb.collection('Verified_Student').findOne({
                enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i')
            });
        }

        if (!record) {
            return res.status(404).send('Student record not found.');
        }

        let docItem = null;
        if (Array.isArray(record.documents) && record.documents.length > idx) {
            docItem = record.documents[idx];
        } else if (record.fileDataUrl) {
            docItem = {
                docName: record.docName || 'Offer_Document.pdf',
                fileDataUrl: record.fileDataUrl
            };
        }

        if (!docItem || !docItem.fileDataUrl) {
            return res.redirect('/docs/SDSF_Internship_Permission_Letter.pdf');
        }

        const dataUrl = docItem.fileDataUrl;
        if (!dataUrl.startsWith('data:')) {
            return res.redirect(dataUrl);
        }

        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
            return res.status(400).send('Invalid document encoding.');
        }

        const contentType = match[1] || 'application/pdf';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = (docItem.docName || 'document.pdf').replace(/["\r\n]/g, '');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
    } catch (err) {
        console.error('Error serving document:', err);
        return res.status(500).send('Internal server error loading document.');
    }
};

/**
 * API: Student Requests Password Reset OTP to Registered Email
 */
const sendStudentPasswordOtp = async (req, res) => {
    const { enrollmentNo } = req.body;
    const cleanEnrollment = (enrollmentNo || '').trim();

    if (!cleanEnrollment) {
        return res.status(400).json({ success: false, message: 'Please enter your Enrollment Number.' });
    }

    try {
        const studentInfo = await searchStudentInAllCollections(cleanEnrollment);
        const verificationDb = getVerificationDb();
        const verifiedCollection = verificationDb.collection('Verified_Student');
        const verifiedRecord = await verifiedCollection.findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i')
        });

        if (!studentInfo && !verifiedRecord) {
            return res.status(404).json({
                success: false,
                message: `Enrollment number "${cleanEnrollment}" was not found in SDSF student records.`
            });
        }

        const studentName = (studentInfo && studentInfo.studentName) || (verifiedRecord && verifiedRecord.studentName) || 'Student';
        const studentEmail = (studentInfo && studentInfo.email) || (verifiedRecord && verifiedRecord.email);
        const course = (studentInfo && studentInfo.course) || (verifiedRecord && verifiedRecord.course) || '';
        const collectionName = (studentInfo && studentInfo.collectionName) || (verifiedRecord && verifiedRecord.originalCollection) || '';

        if (!studentEmail) {
            return res.status(400).json({
                success: false,
                message: 'No registered email address found for this enrollment number. Please contact the department administrator.'
            });
        }

        const otp = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

        // Upsert OTP and expiry into Verified_Student
        await verifiedCollection.updateOne(
            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
            {
                $set: {
                    studentName,
                    enrollmentNo: cleanEnrollment.toUpperCase(),
                    email: studentEmail,
                    course,
                    originalCollection: collectionName,
                    resetPasswordOtp: otp,
                    resetPasswordExpires: expiresAt,
                    updatedAt: new Date()
                },
                $setOnInsert: { createdAt: new Date(), isApproved: false }
            },
            { upsert: true }
        );

        // Send OTP email with tailored password reset message
        const emailResult = await sendVerificationEmail({
            toEmail: studentEmail,
            studentName,
            verificationCode: otp,
            purpose: 'password_reset'
        });

        console.log(`[Password Reset OTP] Dispatched OTP to ${studentEmail} for student ${cleanEnrollment} (result: ${emailResult.success})`);

        return res.json({
            success: true,
            message: `Verification OTP has been sent to your registered email (${maskEmail(studentEmail)}).`,
            maskedEmail: maskEmail(studentEmail)
        });
    } catch (err) {
        console.error('Error in sendStudentPasswordOtp:', err);
        return res.status(500).json({ success: false, message: 'Server error while sending verification OTP.' });
    }
};

/**
 * API: Student Verifies OTP and Resets / Changes Password
 */
const resetStudentPassword = async (req, res) => {
    const { enrollmentNo, otp, newPassword, confirmPassword } = req.body;
    const cleanEnrollment = (enrollmentNo || '').trim();
    const cleanOtp = (otp || '').trim();
    const cleanPassword = (newPassword || '').trim();

    if (!cleanEnrollment) {
        return res.status(400).json({ success: false, message: 'Enrollment Number is required.' });
    }
    if (!cleanOtp) {
        return res.status(400).json({ success: false, message: 'Verification OTP is required.' });
    }
    if (!cleanPassword || cleanPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }
    if (confirmPassword && cleanPassword !== confirmPassword.trim()) {
        return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    try {
        const verificationDb = getVerificationDb();
        const verifiedCollection = verificationDb.collection('Verified_Student');

        const record = await verifiedCollection.findOne({
            enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i')
        });

        if (!record || !record.resetPasswordOtp) {
            return res.status(400).json({
                success: false,
                message: 'No active password reset request found. Please request a new verification OTP.'
            });
        }

        if (record.resetPasswordOtp.toString().trim() !== cleanOtp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification OTP code. Please check your email and try again.'
            });
        }

        if (record.resetPasswordExpires && new Date() > new Date(record.resetPasswordExpires)) {
            return res.status(400).json({
                success: false,
                message: 'The verification OTP code has expired. Please request a new code.'
            });
        }

        // Hash new password using bcrypt
        const hashedPassword = await bcrypt.hash(cleanPassword, 10);

        // Update password and clear OTP in Verified_Student
        await verifiedCollection.updateOne(
            { _id: record._id },
            {
                $set: {
                    password: hashedPassword,
                    updatedAt: new Date()
                },
                $unset: {
                    resetPasswordOtp: '',
                    resetPasswordExpires: ''
                }
            }
        );

        // Also update in student's course collection in Students DB if known
        const targetCollection = record.originalCollection;
        if (targetCollection) {
            try {
                const studentsDb = getStudentsDb();
                await studentsDb.collection(targetCollection).updateOne(
                    {
                        $or: [
                            { enrollmentNo: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') },
                            { enrollment_no: new RegExp(`^${escapeRegex(cleanEnrollment)}$`, 'i') }
                        ]
                    },
                    { $set: { password: hashedPassword } }
                );
            } catch (err) {
                console.error('Error updating password in Students course collection:', err);
            }
        }

        console.log(`[Password Reset Success] Password updated and hashed for student ${cleanEnrollment}`);
        return res.json({
            success: true,
            message: 'Your password has been changed and securely saved! You can now log in with your new password.'
        });
    } catch (err) {
        console.error('Error in resetStudentPassword:', err);
        return res.status(500).json({ success: false, message: 'Server error while updating password.' });
    }
};

module.exports = {
    showLoginPage,
    handleLogin,
    verifyTeacherPassword,
    getTeacherDashboard,
    submitStudentNoc,
    approveStudentNoc,
    bulkApproveStudents,
    revokeStudentNoc,
    getStudentStatus,
    searchStudentInAllCollections,
    generateVerificationCode,
    saveToVerifiedStudent,
    viewDocument,
    sendStudentPasswordOtp,
    resetStudentPassword
};
