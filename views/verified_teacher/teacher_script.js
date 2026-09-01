/* ==========================================================================
   SDSF Teacher Internship Portal Script - Table Filtering & Export
   School of Data Science & Forecasting, DAVV Indore
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("teacherTableBody");
    const courseSelect = document.getElementById("filterCourse");
    const semesterSelect = document.getElementById("filterSemester");
    const searchInput = document.getElementById("filterSearch");

    let allStudents = [];

    // Teacher Logout Handler
    const teacherLogoutBtn = document.getElementById("btnTeacherLogout");
    if (teacherLogoutBtn) {
        teacherLogoutBtn.addEventListener("click", function () {
            if (confirm("Are you sure you want to log out of the Faculty Portal?")) {
                sessionStorage.removeItem("teacher_id");
                window.location.href = "http://localhost:5000/login";
            }
        });
    }

    loadStudentData();

    function formatSemester(semStr) {
        if (!semStr) return 'Sem I';
        const map = {
            "Semester 1": "Sem I", "Semester 2": "Sem II", "Semester 3": "Sem III",
            "Semester 4": "Sem IV", "Semester 5": "Sem V", "Semester 6": "Sem VI",
            "Semester 7": "Sem VII", "Semester 8": "Sem VIII", "Semester 9": "Sem IX",
            "Semester 10": "Sem X"
        };
        return map[semStr] || semStr;
    }

    function loadStudentData() {
        allStudents = [];

        // Check if student submissions exist from student application form
        const allNocsJson = localStorage.getItem("sdsf_all_student_nocs");
        if (allNocsJson) {
            try {
                const allNocsObj = JSON.parse(allNocsJson);
                Object.values(allNocsObj).forEach(studentObj => {
                    allStudents.unshift(studentObj);
                });
            } catch (e) {
                console.error("Error loading NOCs:", e);
            }
        } else {
            const savedStudent = localStorage.getItem("sdsf_student_noc");
            if (savedStudent) {
                try {
                    const studentObj = JSON.parse(savedStudent);
                    allStudents.unshift(studentObj);
                } catch (e) {}
            }
        }

        renderTable();
    }

    function renderTable() {
        if (!tableBody) return;

        const selectedCourse = courseSelect ? courseSelect.value : "all";
        const selectedSemester = semesterSelect ? semesterSelect.value : "all";
        const searchText = searchInput ? searchInput.value.toLowerCase().trim() : "";

        const filtered = allStudents.filter(std => {
            const matchCourse = (selectedCourse === "all" || std.studentCourse === selectedCourse);
            const matchSemester = (selectedSemester === "all" || std.studentSemester === selectedSemester);
            const matchSearch = searchText === "" ||
                std.studentName.toLowerCase().includes(searchText) ||
                std.companyName.toLowerCase().includes(searchText) ||
                std.studentCourse.toLowerCase().includes(searchText);

            return matchCourse && matchSemester && matchSearch;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: #64748b; padding: 25px;">
                        <i class="fas fa-search fa-2x" style="margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                        No student records found matching the selected Course / Semester filters.
                    </td>
                </tr>
            `;
            return;
        }

        let html = "";
        filtered.forEach((std, index) => {
            const isApproved = std.status === "Approved";
            const isRejected = std.status === "Rejected";

            html += `
                <tr>
                    <td><strong>${index + 1}</strong></td>
                    <td>${escapeHtml(std.studentName)}</td>
                    <td>${escapeHtml(std.studentCourse)}</td>
                    <td><span style="font-weight: 600; color: #3730a3;">${escapeHtml(formatSemester(std.studentSemester))}</span></td>
                    <td>${escapeHtml(std.companyName)}</td>
                    <td><span class="badge-mode">${escapeHtml(std.internshipMode)}</span></td>
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-size: 12px; font-weight: 500; color: #334155;"><i class="fas fa-file-pdf" style="color: #ef4444;"></i> ${escapeHtml(std.fileName)}</span>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px;">
                                <button type="button" class="btn-doc-action btn-doc-view" onclick="viewAttachedDocument('${std.id}')" title="View PDF Document">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button type="button" class="btn-doc-action btn-doc-download" onclick="downloadAttachedDocument('${std.id}')" title="Download PDF Document">
                                    <i class="fas fa-download"></i> Download
                                </button>
                            </div>
                        </div>
                    </td>
                    <td><small style="color: #475569;">${escapeHtml(std.date)}</small></td>
                    <td>
                        ${isApproved ? `<span class="status-badge status-approved"><i class="fas fa-check-circle"></i> Approved</span>` :
                          isRejected ? `<span class="status-badge status-rejected"><i class="fas fa-times-circle"></i> Disapproved</span>` :
                          `<span class="status-badge status-pending"><i class="fas fa-clock"></i> Pending</span>`}
                    </td>
                    <td>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                            ${!isApproved && !isRejected ? `
                                <button type="button" class="btn-action-approve" onclick="approveStudent('${std.id}')">
                                    <i class="fas fa-check"></i> Approve
                                </button>
                                <button type="button" class="btn-action-reject" onclick="rejectStudent('${std.id}')">
                                    <i class="fas fa-times"></i> Disapprove
                                </button>
                            ` : `
                                <button type="button" class="btn-doc-action btn-doc-noc" onclick="viewGeneratedNocLetter('${std.id}')" title="View & Print Official NOC Letter">
                                    <i class="fas fa-file-signature"></i> View NOC
                                </button>
                                <button type="button" class="btn-change-status" onclick="changeStudentStatusPrompt('${std.id}')" title="Modify Approval / Status">
                                    <i class="fas fa-edit"></i> Edit Status
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;
    }

    if (courseSelect) courseSelect.addEventListener("change", renderTable);
    if (semesterSelect) semesterSelect.addEventListener("change", renderTable);
    if (searchInput) searchInput.addEventListener("input", renderTable);

    function updateStudentStatus(studentId, newStatus) {
        const student = allStudents.find(s => s.id === studentId);
        if (student) {
            student.status = newStatus;

            const allNocsJson = localStorage.getItem("sdsf_all_student_nocs");
            if (allNocsJson) {
                try {
                    let allNocs = JSON.parse(allNocsJson);
                    const key = student.enrollmentNo || Object.keys(allNocs).find(k => allNocs[k].id === student.id);
                    if (key) {
                        allNocs[key].status = newStatus;
                        localStorage.setItem("sdsf_all_student_nocs", JSON.stringify(allNocs));
                    }
                } catch(e) {}
            }

            const legacySaved = localStorage.getItem("sdsf_student_noc");
            if (legacySaved) {
                try {
                    const parsed = JSON.parse(legacySaved);
                    if (parsed.id === student.id) {
                        parsed.status = newStatus;
                        localStorage.setItem("sdsf_student_noc", JSON.stringify(parsed));
                    }
                } catch(e) {}
            }

            renderTable();
        }
    }

    window.approveStudent = function (studentId) {
        if (confirm("Are you sure you want to APPROVE this NOC application? The official NOC will be generated for the student.")) {
            updateStudentStatus(studentId, "Approved");
        }
    };

    window.rejectStudent = function (studentId) {
        if (confirm("Are you sure you want to DISAPPROVE / REJECT this NOC application?")) {
            updateStudentStatus(studentId, "Rejected");
        }
    };

    window.changeStudentStatusPrompt = function (studentId) {
        const student = allStudents.find(s => s.id === studentId);
        if (!student) return;

        const current = student.status;
        const newStatus = current === "Approved" ? "Rejected" : "Approved";
        const promptMsg = `Currently status is "${current}". Would you like to change status to "${newStatus}"? Click OK to change or Cancel to keep as Pending.`;

        if (confirm(promptMsg)) {
            updateStudentStatus(studentId, newStatus);
        } else {
            if (confirm(`Reset status back to "Pending" review?`)) {
                updateStudentStatus(studentId, "Pending");
            }
        }
    };

    // View Attached Document in Modal
    window.viewAttachedDocument = function (studentId) {
        const student = allStudents.find(s => s.id === studentId);
        if (!student) return;

        const modal = document.createElement("div");
        modal.className = "pdf-modal-overlay";
        modal.id = "docViewModal";

        let contentSrc = student.fileDataUrl || "";
        let bodyHtml = "";

        if (contentSrc.startsWith("data:")) {
            bodyHtml = `<iframe src="${contentSrc}" title="Attached Document"></iframe>`;
        } else {
            bodyHtml = `
                <div style="text-align: center; padding: 40px; color: #475569;">
                    <i class="fas fa-file-pdf fa-4x" style="color: #dc2626; margin-bottom: 15px;"></i>
                    <h4 style="margin: 0 0 10px 0; color: #1e293b;">${escapeHtml(student.fileName || 'Internship_Offer_Sample.pdf')}</h4>
                    <p style="margin: 0 0 20px 0; font-size: 14px;">This is a demonstration document record attached by ${escapeHtml(student.studentName)}.</p>
                    <button type="button" class="btn-export btn-export-excel" onclick="downloadAttachedDocument('${student.id}')" style="background: #0284c7;">
                        <i class="fas fa-download"></i> Download / Open Document
                    </button>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="pdf-modal-container">
                <div class="pdf-modal-header">
                    <h3><i class="fas fa-file-alt"></i> Attached Document: ${escapeHtml(student.fileName || 'Offer Letter')}</h3>
                    <button type="button" onclick="closeDocModal()" style="background: transparent; border: none; color: #ffffff; font-size: 20px; cursor: pointer;">&times;</button>
                </div>
                <div class="pdf-modal-body">
                    ${bodyHtml}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    };

    window.closeDocModal = function () {
        const modal = document.getElementById("docViewModal");
        if (modal) modal.remove();
    };

    // Download Attached Document
    window.downloadAttachedDocument = function (studentId) {
        const student = allStudents.find(s => s.id === studentId);
        if (!student) return;

        const filename = student.fileName || `${student.studentName.replace(/\s+/g, '_')}_Internship_Doc.pdf`;

        if (student.fileDataUrl && student.fileDataUrl.startsWith("data:")) {
            const link = document.createElement("a");
            link.href = student.fileDataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const textContent = `
============================================================
SDSF INTERNSHIP PORTAL - ATTACHED OFFER DOCUMENT
School of Data Science & Forecasting, DAVV Indore
============================================================
Student Name:    ${student.studentName}
Course:          ${student.studentCourse}
Semester:        ${formatSemester(student.studentSemester)}
Company Name:    ${student.companyName}
Internship Mode: ${student.internshipMode}
Submitted Date:  ${student.date}
Status:          ${student.status}
Document Name:   ${student.fileName}
============================================================
            `.trim();

            const blob = new Blob([textContent], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    // View Official Generated NOC Letter Modal for Teacher
    window.viewGeneratedNocLetter = function (studentId) {
        const student = allStudents.find(s => s.id === studentId);
        if (!student) return;

        document.body.classList.add("noc-printing-active");

        const isDisapproved = student.status === "Rejected" || student.status === "Disapproved";

        const modal = document.createElement("div");
        modal.className = "printable-noc-overlay";
        modal.id = "teacherNocLetterModal";
        modal.innerHTML = `
            <div class="printable-noc-paper">
                <div class="noc-print-actions">
                    <button onclick="window.print()" style="background: ${isDisapproved ? '#ef4444' : '#10b981'}; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;"><i class="fas fa-print"></i> Print / Save as PDF</button>
                    <button onclick="closeTeacherNocModal()" style="background: #64748b; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">Close</button>
                </div>

                <div class="noc-letter-header">
                    <h2>DEVI AHILYA VISHWAVIDYALAYA, INDORE</h2>
                    <h3>SCHOOL OF DATA SCIENCE AND FORECASTING (SDSF)</h3>
                    <p style="font-size: 13px; margin: 0;">Takshila Campus, Khandwa Road, Indore - 452001 (M.P.)</p>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 14px;">
                    <div><strong>Ref No:</strong> SDSF/NOC/2026/${student.id || 'NOC-1092'}</div>
                    <div><strong>Date:</strong> ${student.date}</div>
                </div>

                ${isDisapproved ? `
                    <div style="font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 20px; color: #dc2626; text-decoration: underline;">
                        NOTICE OF NOC DISAPPROVAL
                    </div>

                    <div class="noc-letter-body">
                        <p>This is to inform that the No Objection Certificate (NOC) application submitted by <strong>${escapeHtml(student.studentName)}</strong>, a bonafide student of the School of Data Science and Forecasting, Devi Ahilya Vishwavidyalaya, Indore, pursuing <strong>${escapeHtml(student.studentCourse)}</strong> (${escapeHtml(formatSemester(student.studentSemester))}), has been <strong>REVIEWED AND DISAPPROVED</strong> by the SDSF Faculty Cell.</p>

                        <p>The Department currently has <strong>DISAPPROVED / WITHHELD OBJECTION PERMISSION</strong> for the candidate to undergo the requested internship program at <strong>${escapeHtml(student.companyName)}</strong> (${escapeHtml(student.internshipMode || 'Off Campus')}).</p>

                        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-left: 4px solid #ef4444; padding: 12px 15px; border-radius: 4px; font-weight: 500; color: #991b1b; margin: 15px 0;">
                            <strong>Status:</strong> APPLICATION DISAPPROVED BY FACULTY AUTHORITY
                        </div>

                        <p>The candidate may contact the Head of Department or SDSF Internship Cell for clarification or resubmit a fresh NOC application if necessary.</p>
                    </div>
                ` : `
                    <div style="font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 20px; text-decoration: underline;">
                        NO OBJECTION CERTIFICATE (NOC)
                    </div>

                    <div class="noc-letter-body">
                        <p>This is to certify that <strong>${escapeHtml(student.studentName)}</strong> is a bonafide student of the School of Data Science and Forecasting, Devi Ahilya Vishwavidyalaya, Indore, pursuing <strong>${escapeHtml(student.studentCourse)}</strong> (${escapeHtml(formatSemester(student.studentSemester))}).</p>

                        <p>The Department has <strong>NO OBJECTION</strong> for the candidate to undergo an internship program at <strong>${escapeHtml(student.companyName)}</strong> (${escapeHtml(student.internshipMode || 'Off Campus')}) as part of their academic curriculum requirements.</p>

                        <p>During the period of internship, the student will abide by the rules and discipline of both the host organization and the university.</p>

                        <p>We wish the student all success in their internship endeavor.</p>
                    </div>
                `}

                <div class="noc-letter-footer">
                    <div>
                        <p style="margin: 0; font-size: 12px; color: #555;">Verified & Issued Digitally</p>
                        <p style="margin: 0; font-size: 13px; font-weight: bold;">SDSF Internship Cell</p>
                    </div>
                    <div style="text-align: right;">
                        <br><br>
                        <p style="margin: 0; font-weight: bold; font-size: 15px;">Head of Department</p>
                        <p style="margin: 0; font-size: 13px;">School of Data Science & Forecasting</p>
                        <p style="margin: 0; font-size: 13px;">DAVV, Indore</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };

    window.closeTeacherNocModal = function () {
        const modal = document.getElementById("teacherNocLetterModal");
        if (modal) modal.remove();
        document.body.classList.remove("noc-printing-active");
    };

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // Back to top
    const backToTopBtn = document.getElementById("sdsfBackToTop");
    if (backToTopBtn) {
        backToTopBtn.addEventListener("click", function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
});
