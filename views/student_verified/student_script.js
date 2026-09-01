/* ==========================================================================
   SDSF Student Internship Portal Script - 3-Section Sidebar Flow
   School of Data Science & Forecasting, DAVV Indore
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    const studentForm = document.getElementById("studentNocForm");
    const sidebarTabs = document.querySelectorAll(".sidebar-tab");
    const tabSections = document.querySelectorAll(".tab-content-section");

    // Student Logout Handler
    const logoutBtn = document.getElementById("btnStudentLogout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            if (confirm("Are you sure you want to log out?")) {
                sessionStorage.removeItem("student_enrollment");
                sessionStorage.removeItem("sdsf_student_user");
                document.cookie = "student_enrollment=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                window.location.href = "http://localhost:5000/login";
            }
        });
    }

    // Auto-fill student profile details from logged-in session
    const loggedInUserJson = sessionStorage.getItem("sdsf_student_user");
    if (loggedInUserJson) {
        try {
            const studentUser = JSON.parse(loggedInUserJson);
            const nameInput = document.getElementById("studentName");
            const courseSelect = document.getElementById("studentCourse");

            if (nameInput && studentUser.full_name) {
                nameInput.value = studentUser.full_name;
            }

            if (courseSelect && studentUser.course) {
                for (let option of courseSelect.options) {
                    if (option.value.trim().toLowerCase() === studentUser.course.trim().toLowerCase()) {
                        courseSelect.value = option.value;
                        break;
                    }
                }
            }
        } catch (e) {
            console.error("Error loading student user session:", e);
        }
    }

    // 1. Sidebar Tab Navigation Logic
    sidebarTabs.forEach(tab => {
        tab.addEventListener("click", function () {
            const targetTabId = this.getAttribute("data-tab");

            // Update active state on tab buttons
            sidebarTabs.forEach(t => t.classList.remove("active"));
            this.classList.add("active");

            // Update active section visibility
            tabSections.forEach(sec => {
                if (sec.id === targetTabId) {
                    sec.classList.add("active");
                } else {
                    sec.classList.remove("active");
                }
            });

            // Re-render contents when switching tabs
            loadAndRenderData();
        });
    });

    // 2. Load and render state from localStorage
    loadAndRenderData();

    // Dynamic Multi-Document Attachment Handling (+ Add Document)
    const btnAddMoreDocs = document.getElementById("btnAddMoreDocs");
    const documentsListContainer = document.getElementById("documentsListContainer");

    if (btnAddMoreDocs && documentsListContainer) {
        btnAddMoreDocs.addEventListener("click", function () {
            const count = documentsListContainer.querySelectorAll(".doc-upload-row").length;
            const newRow = document.createElement("div");
            newRow.className = "doc-upload-row";
            newRow.style.cssText = "display: flex; gap: 10px; align-items: center; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px dashed #cbd5e1;";
            newRow.innerHTML = `
                <input type="file" class="internship-doc-file" accept=".pdf,.doc,.docx" required style="flex-grow: 1;">
                <input type="text" class="internship-doc-label" placeholder="Label (e.g. Resume, Annexure)" value="Document ${count + 1}" style="width: 170px; padding: 7px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px;">
                <button type="button" class="btn-remove-doc" style="background: #ef4444; color: white; border: none; width: 30px; height: 30px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Remove document">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;

            newRow.querySelector(".btn-remove-doc").addEventListener("click", function () {
                newRow.remove();
                updateRemoveButtons();
            });

            documentsListContainer.appendChild(newRow);
            updateRemoveButtons();
        });
    }

    function updateRemoveButtons() {
        if (!documentsListContainer) return;
        const rows = documentsListContainer.querySelectorAll(".doc-upload-row");
        rows.forEach((row) => {
            const removeBtn = row.querySelector(".btn-remove-doc");
            if (removeBtn) {
                removeBtn.style.display = rows.length > 1 ? "flex" : "none";
            }
        });
    }

    // 3. Form Submit Handler (Multi-Document Support)
    if (studentForm) {
        studentForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const studentName = document.getElementById("studentName").value.trim();
            const studentCourse = document.getElementById("studentCourse").value;
            const studentSemester = document.getElementById("studentSemester") ? document.getElementById("studentSemester").value : "Semester X";
            const companyName = document.getElementById("companyName").value.trim();
            const internshipMode = document.querySelector('input[name="internshipMode"]:checked')?.value || "Off Campus";

            function getCurrentEnrollmentNo() {
                const hiddenEnrollment = document.getElementById("studentEnrollment");
                if (hiddenEnrollment && hiddenEnrollment.value.trim()) {
                    return hiddenEnrollment.value.trim();
                }
                const loggedInUserJson = sessionStorage.getItem("sdsf_student_user");
                if (loggedInUserJson) {
                    try {
                        const u = JSON.parse(loggedInUserJson);
                        if (u.enrollment_no) return u.enrollment_no.trim();
                    } catch (e) {}
                }
                return sessionStorage.getItem("student_enrollment") || "MB2402285";
            }

            // Read all attached files
            const docRows = document.querySelectorAll(".doc-upload-row");
            const filePromises = [];

            docRows.forEach((row, idx) => {
                const fileInput = row.querySelector(".internship-doc-file");
                const labelInput = row.querySelector(".internship-doc-label");
                const label = (labelInput && labelInput.value.trim()) || `Document ${idx + 1}`;

                if (fileInput && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const p = new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = function (event) {
                            resolve({
                                docName: file.name,
                                label: label,
                                fileDataUrl: event.target.result
                            });
                        };
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(file);
                    });
                    filePromises.push(p);
                }
            });

            const uploadedDocuments = (await Promise.all(filePromises)).filter(Boolean);
            const mainDoc = uploadedDocuments[0] || { docName: 'Offer_Document.pdf', fileDataUrl: '' };
            const enrollmentNo = getCurrentEnrollmentNo();

            const requestData = {
                id: "NOC-" + Math.floor(1000 + Math.random() * 9000),
                enrollmentNo: enrollmentNo,
                studentName: studentName,
                course: studentCourse,
                semester: studentSemester,
                companyName: companyName,
                internshipMode: internshipMode,
                docName: mainDoc.docName,
                fileDataUrl: mainDoc.fileDataUrl,
                documents: uploadedDocuments,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                status: "Pending"
            };

            // 1. Post to MongoDB Backend -> Verification.Requested_Student
            try {
                await fetch('/api/student/apply-noc', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        studentName: studentName,
                        enrollmentNo: enrollmentNo,
                        course: studentCourse,
                        semester: studentSemester,
                        companyName: companyName,
                        internshipMode: internshipMode,
                        docName: mainDoc.docName,
                        fileDataUrl: mainDoc.fileDataUrl,
                        documents: uploadedDocuments
                    })
                });
            } catch (err) {
                console.error("Backend sync error:", err);
            }

            // 2. Save in localStorage for client-side document rendering
            const allNocsJson = localStorage.getItem("sdsf_all_student_nocs");
            let allNocs = allNocsJson ? JSON.parse(allNocsJson) : {};
            allNocs[enrollmentNo] = requestData;
            localStorage.setItem("sdsf_all_student_nocs", JSON.stringify(allNocs));
            localStorage.setItem("sdsf_student_noc", JSON.stringify(requestData));

            alert(`Application submitted successfully with ${uploadedDocuments.length} document(s)! Your request has been sent to the SDSF Faculty.`);

            // Switch automatically to Section 2: OFFER / NOC LETTER
            switchToTab("secOfferLetter");
            loadAndRenderData();
        });
    }

    function switchToTab(tabId) {
        sidebarTabs.forEach(t => {
            if (t.getAttribute("data-tab") === tabId) {
                t.classList.add("active");
            } else {
                t.classList.remove("active");
            }
        });

        tabSections.forEach(sec => {
            if (sec.id === tabId) {
                sec.classList.add("active");
            } else {
                sec.classList.remove("active");
            }
        });
    }

    function getCurrentEnrollmentNo() {
        const hiddenEnrollment = document.getElementById("studentEnrollment");
        if (hiddenEnrollment && hiddenEnrollment.value.trim()) {
            return hiddenEnrollment.value.trim();
        }

        const serverStateEl = document.getElementById("serverStudentState");
        if (serverStateEl) {
            try {
                const parsed = JSON.parse(serverStateEl.textContent || "{}");
                if (parsed.student && parsed.student.enrollmentNo) {
                    return parsed.student.enrollmentNo.trim();
                }
            } catch(e) {}
        }

        const loggedInUserJson = sessionStorage.getItem("sdsf_student_user");
        if (loggedInUserJson) {
            try {
                const u = JSON.parse(loggedInUserJson);
                if (u.enrollment_no) return u.enrollment_no.trim();
            } catch (e) {}
        }
        return sessionStorage.getItem("student_enrollment") || "MB2402285";
    }

    async function loadAndRenderData() {
        const enrollmentNo = getCurrentEnrollmentNo();

        // 1. Check embedded server state first
        let requestData = null;
        let previousSubmission = null;
        const serverStateEl = document.getElementById("serverStudentState");
        if (serverStateEl) {
            try {
                const parsed = JSON.parse(serverStateEl.textContent || "{}");
                if (parsed.activeApplication) {
                    requestData = parsed.activeApplication;
                }
                if (parsed.previousSubmission) {
                    previousSubmission = parsed.previousSubmission;
                }
            } catch(e) {}
        }

        // 2. Fetch live status from MongoDB backend
        try {
            const res = await fetch(`/api/student/status?enrollmentNo=${encodeURIComponent(enrollmentNo)}`);
            const data = await res.json();
            if (data.success && data.application) {
                requestData = {
                    ...data.application,
                    status: data.isApproved ? "Approved" : (data.status || "Pending Approval"),
                    date: data.application.submittedAt ? new Date(data.application.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString()
                };
            }
            if (data.previousSubmission) {
                previousSubmission = data.previousSubmission;
            }
        } catch(err) {
            console.warn("Could not fetch real-time student status from API, falling back to cached state:", err);
        }

        // 3. Fallback to localStorage if no server/DB application found
        if (!requestData) {
            const allNocsJson = localStorage.getItem("sdsf_all_student_nocs");
            let allNocs = allNocsJson ? JSON.parse(allNocsJson) : {};
            requestData = allNocs[enrollmentNo] || null;
        }

        // Save current active application in localStorage for modals
        if (requestData) {
            localStorage.setItem("sdsf_student_noc", JSON.stringify(requestData));
        }

        // Check if student has a match in Students_Previous_Submissions and show popup modal
        if (previousSubmission && previousSubmission.companyName) {
            checkAndShowPreviousSubmissionPopup(previousSubmission);
        }

        renderOfferLetterSection(requestData);
    }

    // Popup Modal for Students with Matches in Students_Previous_Submissions
    function checkAndShowPreviousSubmissionPopup(data) {
        if (!data || !data.companyName) return;
        
        const enrollmentNo = (data.enrollmentNo || getCurrentEnrollmentNo()).toUpperCase();
        const popupKey = "sdsf_prev_modal_seen_" + enrollmentNo;
        
        // Show once per session on login / reload
        if (sessionStorage.getItem(popupKey)) return;
        sessionStorage.setItem(popupKey, "true");

        if (document.getElementById("previousSubmissionModal")) return;

        const studentName = data.studentName || "Student";
        const companyName = data.companyName || "Organization";
        const course = data.course || "SDSF Program";
        const semester = data.semester || "Semester X";
        const mode = data.internshipMode || "Off Campus";

        let formattedDate = data.date || "Recently";
        if (data.submittedAt) {
            try {
                formattedDate = new Date(data.submittedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            } catch(e) {
                formattedDate = data.date || "Recently";
            }
        }

        let statusText = data.status || "Pending Approval";
        let statusClass = "status-pending";
        if (statusText === "Approved" || data.isApproved) {
            statusClass = "status-approved";
            statusText = "Approved";
        } else if (statusText === "Rejected" || statusText === "Disapproved") {
            statusClass = "status-rejected";
            statusText = "Disapproved";
        }

        // Attached docs
        let docListHtml = "";
        const docs = (Array.isArray(data.documents) && data.documents.length > 0)
            ? data.documents
            : (data.docName ? [{ docName: data.docName, label: "Offer Document" }] : []);

        if (docs.length > 0) {
            docListHtml = `
                <div style="margin-top: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-paperclip"></i> Attached Document(s):
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${docs.map((d, idx) => `
                            <a href="/api/view-document?enrollment=${encodeURIComponent(enrollmentNo)}&docIndex=${idx}" target="_blank" style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #2563eb; background: #ffffff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 4px; text-decoration: none; font-weight: 600;">
                                <i class="fas fa-file-pdf" style="color: #dc2626;"></i> ${escapeHtml(d.label || d.docName || 'Document')}
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const modal = document.createElement("div");
        modal.className = "prev-sub-modal-overlay";
        modal.id = "previousSubmissionModal";
        modal.innerHTML = `
            <div class="prev-sub-modal-card" onclick="event.stopPropagation()">
                <div class="prev-sub-modal-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="background: #e0f2fe; color: #0284c7; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                            <i class="fas fa-id-badge"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 17px; color: #0f172a; font-family: 'Oswald', sans-serif;">Previous Submission Found</h3>
                            <p style="margin: 0; font-size: 12px; color: #64748b;">Record matched in Students Previous Submissions</p>
                        </div>
                    </div>
                    <button type="button" class="btn-close-prev-modal" onclick="closePreviousSubmissionModal()">&times;</button>
                </div>

                <div class="prev-sub-modal-body">
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
                        <p style="margin: 0; font-size: 13.5px; color: #1e40af; line-height: 1.5;">
                            Hello <strong>${escapeHtml(studentName)}</strong> (<strong>${escapeHtml(enrollmentNo)}</strong>), our records show that you have previously submitted an internship application regarding <strong>${escapeHtml(companyName)}</strong>.
                        </p>
                    </div>

                    <div class="prev-sub-details-grid">
                        <div class="prev-sub-detail-item">
                            <span class="detail-label"><i class="fas fa-building"></i> Company / Organization</span>
                            <span class="detail-val">${escapeHtml(companyName)}</span>
                        </div>
                        <div class="prev-sub-detail-item">
                            <span class="detail-label"><i class="fas fa-briefcase"></i> Internship Mode</span>
                            <span class="detail-val">${escapeHtml(mode)}</span>
                        </div>
                        <div class="prev-sub-detail-item">
                            <span class="detail-label"><i class="fas fa-graduation-cap"></i> Program & Semester</span>
                            <span class="detail-val">${escapeHtml(course)} (${escapeHtml(semester)})</span>
                        </div>
                        <div class="prev-sub-detail-item">
                            <span class="detail-label"><i class="fas fa-calendar-alt"></i> Submission Date</span>
                            <span class="detail-val">${escapeHtml(formattedDate)}</span>
                        </div>
                        <div class="prev-sub-detail-item" style="grid-column: 1 / -1;">
                            <span class="detail-label"><i class="fas fa-info-circle"></i> Review Status</span>
                            <span class="status-pill ${statusClass}" style="margin-top: 4px;">${escapeHtml(statusText)}</span>
                        </div>
                    </div>

                    ${docListHtml}
                </div>

                <div class="prev-sub-modal-footer">
                    <button type="button" class="btn-prev-modal-secondary" onclick="closePreviousSubmissionModal()">
                        <i class="fas fa-times"></i> Close
                    </button>
                    <button type="button" class="btn-prev-modal-primary" onclick="closePreviousSubmissionModal(); switchToTab('secOfferLetter');">
                        <i class="fas fa-file-signature"></i> View Offer / NOC Letter
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    window.closePreviousSubmissionModal = function() {
        const modal = document.getElementById("previousSubmissionModal");
        if (modal) modal.remove();
    };

    // Render Section 2: Offer / NOC Letter
    function renderOfferLetterSection(data) {
        if (!offerLetterContainer) return;

        if (!data) {
            offerLetterContainer.innerHTML = `
                <div class="offer-pending-card">
                    <i class="fas fa-file-invoice"></i>
                    <h4>No Active Application Found</h4>
                    <p>Please submit your application in the <strong>Application Form</strong> section first. Once submitted, your Internship Offer Letter will appear here automatically, while the NOC Letter will be generated upon teacher approval.</p>
                </div>
            `;
            return;
        }

        const isApproved = data.status === "Approved";
        const isDisapproved = data.status === "Rejected" || data.status === "Disapproved";

        // Section 1 HTML: Automatic Offer Letter (Always Available when applied)
        let html = `
            <div class="panel-sub-header" style="margin-top: 0; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fas fa-envelope-open-text"></i> INTERNSHIP OFFER LETTER </span>
                <span style="font-size: 11px; background: #10b981; color: white; padding: 2px 10px; border-radius: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;"><i class="fas fa-check-circle"></i> Available</span>
            </div>

            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <h4 style="margin: 0 0 5px 0; font-size: 18px; color: #0f172a; font-family: 'Oswald', sans-serif;">
                            <i class="fas fa-building" style="color: #0284c7; margin-right: 6px;"></i> Offer of Internship at ${escapeHtml(data.companyName)}
                        </h4>
                        <p style="margin: 0; font-size: 13.5px; color: #475569;">
                            <strong>Applicant:</strong> ${escapeHtml(data.studentName)} | <strong>Course:</strong> ${escapeHtml(data.studentCourse)} (${escapeHtml(data.studentSemester || 'Sem III')}) | <strong>Mode:</strong> ${escapeHtml(data.internshipMode || 'Off Campus')}
                        </p>
                    </div>
                    <div>
                        <button type="button" class="btn-download-noc" onclick="showPrintableOfferLetter()" style="background: #0284c7;">
                            <i class="fas fa-eye"></i> View & Print Offer Letter
                        </button>
                    </div>
                </div>

                <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 24px; font-family: 'Times New Roman', serif; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    <!-- Header with Dual Logos -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px;">
                        <img src="/photoes/davvLogo.png" alt="DAVV Logo" style="height: 55px; width: auto; object-fit: contain;">
                        <div style="text-align: center; flex-grow: 1;">
                            <h2 style="font-family: 'Times New Roman', serif; margin: 0; font-size: 16px; font-weight: bold; color: #1e3a8a; text-transform: uppercase;">DEVI AHILYA VISHWAVIDYALAYA, INDORE</h2>
                            <h3 style="font-family: 'Times New Roman', serif; margin: 2px 0; font-size: 13px; font-weight: bold; color: #0f172a; text-transform: uppercase;">SCHOOL OF DATA SCIENCE AND FORECASTING (SDSF)</h3>
                            <p style="font-size: 10.5px; margin: 0; font-style: italic; color: #475569;">Takshila Campus, Khandwa Road, Indore – 452001 (M.P.)</p>
                        </div>
                        <img src="/photoes/departmentlogo_transparent.png" alt="SDSF Logo" style="height: 55px; width: auto; object-fit: contain;">
                    </div>

                    <div style="height: 2px; background: #1e3a8a; margin-top: 1px; margin-bottom: 12px;"></div>

                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; font-weight: 600;">
                        <div>Ref No: SDSF/PERMISSION/2026/${data.id || 'PERM-101'}</div>
                        <div>Date: ${data.date}</div>
                    </div>

                    <div style="border-top: 1.5px solid #1e3a8a; border-bottom: 1.5px solid #1e3a8a; padding: 6px 0; margin-bottom: 12px; text-align: center;">
                        <span style="font-size: 13px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">
                            OFFICIAL INTERNSHIP PERMISSION LETTER
                        </span>
                    </div>

                    <p style="font-size: 13px; line-height: 1.6; margin: 0 0 10px 0; text-align: justify; color: #1e293b;">
                        This is to certify that <strong>${escapeHtml(data.studentName)}</strong> (Enrollment / Roll No: <strong>${escapeHtml(data.enrollmentNo || '—')}</strong>) is a bonafide student of the School of Data Science and Forecasting, Devi Ahilya Vishwavidyalaya, Indore, pursuing <strong>${escapeHtml(data.course || data.studentCourse)}</strong> (${escapeHtml(data.semester || data.studentSemester || 'Sem I')}).
                    </p>

                    <p style="font-size: 13px; line-height: 1.6; margin: 0 0 10px 0; text-align: justify; color: #1e293b;">
                        The candidate is hereby granted <strong>OFFICIAL PERMISSION</strong> to join and undergo an internship program at <strong>${escapeHtml(data.companyName)}</strong> (${escapeHtml(data.internshipMode || 'Off-Campus')}) for the current academic session.
                    </p>

                    <div style="margin-top: 12px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; font-family: 'Poppins', sans-serif;">
                        <span><i class="fas fa-file-contract text-blue-600"></i> Dynamic Template: <a href="/docs_dynamic/dynamic_permission_letter.html" target="_blank" class="text-blue-600 font-semibold hover:underline">docs_dynamic/dynamic_permission_letter.html</a></span>
                        <span class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">✓ Real-time Letter</span>
                    </div>
                </div>
            </div>

            <div class="panel-sub-header">
                <i class="fas fa-file-signature"></i> DEPARTMENT NO OBJECTION CERTIFICATE (NOC)
            </div>
        `;

        // Section 2 HTML: NOC (Generated ONLY when teacher approves)
        if (isApproved) {
            html += `
                <div class="noc-accepted-banner" style="text-align: left; align-items: flex-start; margin-top: 15px;">
                    <h3><i class="fas fa-check-circle fa-lg"></i> Application Approved & Official NOC Issued!</h3>
                    <p style="margin: 5px 0 15px 0;">Your No Objection Certificate (NOC) has been reviewed and official approval is granted by SDSF Faculty for <strong>${escapeHtml(data.companyName)}</strong>.</p>
                    
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button type="button" class="btn-download-noc" onclick="showPrintableNoc()"><i class="fas fa-file-pdf"></i> View & Print Official NOC Letter</button>
                    </div>
                </div>

                <div class="panel-sub-header" style="margin-top: 30px;">Official NOC Letter Preview</div>
                
                <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 35px 40px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); font-family: 'Times New Roman', Times, serif;">
                    <!-- Letterhead with Dual Logos -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">
                        <img src="/photoes/davvLogo.png" alt="DAVV Logo" style="height: 65px; width: auto; object-fit: contain;">
                        <div style="text-align: center; flex-grow: 1;">
                            <h2 style="font-family: 'Times New Roman', serif; margin: 0; font-size: 18px; font-weight: bold; color: #1e3a8a; text-transform: uppercase;">DEVI AHILYA VISHWAVIDYALAYA, INDORE</h2>
                            <h3 style="font-family: 'Times New Roman', serif; margin: 3px 0; font-size: 14px; font-weight: bold; color: #0f172a; text-transform: uppercase;">SCHOOL OF DATA SCIENCE AND FORECASTING (SDSF)</h3>
                            <p style="font-size: 11px; margin: 0; font-style: italic; color: #475569;">Takshila Campus, Khandwa Road, Indore – 452001 (M.P.)</p>
                        </div>
                        <img src="/photoes/departmentlogo_transparent.png" alt="SDSF Logo" style="height: 65px; width: auto; object-fit: contain;">
                    </div>

                    <div style="height: 3px; background: #1e3a8a; margin-top: 2px; margin-bottom: 16px;"></div>

                    <div style="display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13.5px; font-weight: 600;">
                        <div>Ref No: SDSF/NOC/2026/${data.id || 'NOC-101'}</div>
                        <div>Date: ${data.date}</div>
                    </div>

                    <div style="border-top: 1.5px solid #1e3a8a; border-bottom: 1.5px solid #1e3a8a; padding: 8px 0; margin-bottom: 18px; text-align: center;">
                        <h4 style="font-size: 15px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
                            OFFICIAL NO OBJECTION CERTIFICATE (NOC)
                        </h4>
                    </div>

                    <div style="font-size: 14.5px; line-height: 1.8; text-align: justify; margin-bottom: 30px;">
                        <p style="margin-bottom: 16px;">This is to certify that <strong>${escapeHtml(data.studentName)}</strong> (Enrollment / Roll No: <strong>${escapeHtml(data.enrollmentNo || '—')}</strong>) is a bonafide student of the School of Data Science and Forecasting, Devi Ahilya Vishwavidyalaya, Indore, pursuing <strong>${escapeHtml(data.course || data.studentCourse)}</strong> (${escapeHtml(data.semester || data.studentSemester || 'Sem I')}).</p>

                        <p style="margin-bottom: 16px;">The Department has <strong>NO OBJECTION</strong> for the candidate to undergo an internship program at <strong>${escapeHtml(data.companyName)}</strong> (${escapeHtml(data.internshipMode || 'Off-Campus')}) for the current academic session.</p>

                        <p style="margin-bottom: 16px;">During the period of internship, the student will abide by all rules, academic discipline, and code of conduct of both the host organization and the university.</p>

                        <p>We wish the student all success in their professional endeavor.</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 10px;">
                        <div>
                            <div style="width: 160px; border-top: 1px solid #64748b; margin-bottom: 5px;"></div>
                            <p style="margin: 0; font-size: 13px; font-weight: bold;">Signature of Student</p>
                            <p style="margin: 0; font-size: 12px; color: #555;">Student Name: <strong>${escapeHtml(data.studentName)}</strong></p>
                        </div>
                        <div style="text-align: right;">
                            <div style="width: 190px; margin-left: auto; border-top: 1.5px solid #0f172a; margin-bottom: 5px;"></div>
                            <p style="margin: 0; font-weight: bold; font-size: 14px; text-transform: uppercase;">Head of Department</p>
                            <p style="margin: 0; font-size: 12.5px; color: #475569;">School of Data Science & Forecasting</p>
                            <p style="margin: 0; font-size: 12px; color: #475569;">DAVV, Indore</p>
                        </div>
                    </div>
                </div>
            `;
        } else if (isDisapproved) {
            html += `
                <div class="offer-rejected-card" style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 30px; text-align: center; color: #991b1b; margin-top: 15px;">
                    <i class="fas fa-times-circle" style="font-size: 42px; color: #dc2626; margin-bottom: 12px;"></i>
                    <h4 style="font-size: 20px; font-family: 'Oswald', sans-serif; color: #991b1b; margin: 0 0 10px 0;">NOC Application Disapproved / Rejected</h4>
                    <p style="margin: 0 0 20px 0; font-size: 14px; color: #7f1d1d;">Your NOC Application for <strong>${escapeHtml(data.companyName)}</strong> has been reviewed and <strong>DISAPPROVED</strong> by the SDSF Faculty. Please contact the department or resubmit your application if required.</p>
                    <button type="button" class="btn-download-noc" onclick="showPrintableNoc()" style="background: #dc2626; margin: 0 auto;"><i class="fas fa-file-pdf"></i> View Official Disapproval Notice</button>
                </div>
            `;
        } else {
            // Status is Pending
            html += `
                <div style="background: #fffbe6; border: 1.5px solid #fde047; border-left: 5px solid #f59e0b; padding: 22px; border-radius: 8px; margin-top: 15px;">
                    <div style="display: flex; gap: 15px; align-items: flex-start;">
                        <i class="fas fa-clock fa-2x" style="color: #f59e0b; margin-top: 3px;"></i>
                        <div>
                            <h4 style="margin: 0 0 6px 0; color: #92400e; font-size: 18px; font-family: 'Oswald', sans-serif;">
                                NOC Generation Pending Teacher Approval
                            </h4>
                            <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.5;">
                                Your application for <strong>${escapeHtml(data.companyName)}</strong> is currently undergoing SDSF Faculty review. 
                                <strong>The official No Objection Certificate (NOC) will be generated here automatically once your teacher approves the application.</strong>
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }

        offerLetterContainer.innerHTML = html;
    }

    // Show printable/downloadable Offer Letter modal
    window.showPrintableOfferLetter = function () {
        const savedData = localStorage.getItem("sdsf_student_noc");
        const data = savedData ? JSON.parse(savedData) : {
            id: "OFFER-1092",
            studentName: "Student Name",
            studentCourse: "M.Sc. Data Science & Analytics",
            studentSemester: "Sem III",
            companyName: "Organization",
            internshipMode: "Off Campus",
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };

        const modal = document.createElement("div");
        modal.className = "printable-noc-overlay";
        modal.id = "printableOfferModal";
        modal.onclick = function (e) {
            if (e.target === modal) closePrintableOffer();
        };
        modal.innerHTML = `
            <div class="printable-noc-paper" style="font-family: 'Times New Roman', serif; max-width: 820px; padding: 45px 50px;" onclick="event.stopPropagation()">
                <div class="noc-print-actions" style="margin-bottom: 25px;">
                    <button onclick="window.print()" style="background: #1e3a8a; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;"><i class="fas fa-print"></i> Print / Save as PDF</button>
                    <button onclick="closePrintableOffer()" style="background: #64748b; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">Close</button>
                </div>

                <!-- Letterhead with Dual Logos -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">
                    <img src="/photoes/davvLogo.png" alt="DAVV Logo" style="height: 70px; width: auto; object-fit: contain;">
                    <div style="text-align: center; flex-grow: 1;">
                        <h2 style="font-family: 'Times New Roman', serif; margin: 0; font-size: 18px; font-weight: bold; color: #1e3a8a; text-transform: uppercase;">DEVI AHILYA VISHWAVIDYALAYA, INDORE</h2>
                        <h3 style="font-family: 'Times New Roman', serif; margin: 3px 0; font-size: 14.5px; font-weight: bold; color: #0f172a; text-transform: uppercase;">SCHOOL OF DATA SCIENCE AND FORECASTING (SDSF)</h3>
                        <p style="font-size: 11.5px; margin: 0; font-style: italic; color: #475569;">Takshila Campus, Khandwa Road, Indore – 452001 (M.P.)</p>
                    </div>
                    <img src="/photoes/departmentlogo_transparent.png" alt="SDSF Logo" style="height: 70px; width: auto; object-fit: contain;">
                </div>

                <div style="height: 3px; background: #1e3a8a; margin-top: 2px; margin-bottom: 16px;"></div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 13.5px; font-weight: 600;">
                    <div>Ref No: SDSF/PERMISSION/2026/${data.id || 'PERM-101'}</div>
                    <div>Date: ${data.date}</div>
                </div>

                <div style="border-top: 1.5px solid #1e3a8a; border-bottom: 1.5px solid #1e3a8a; padding: 8px 0; margin-bottom: 22px; text-align: center;">
                    <h4 style="font-size: 15.5px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
                        OFFICIAL INTERNSHIP PERMISSION LETTER
                    </h4>
                </div>

                <div class="noc-letter-body" style="font-size: 14.5px; line-height: 1.85; text-align: justify;">
                    <p style="margin-bottom: 18px;">
                        This is to certify that <strong>${escapeHtml(data.studentName)}</strong> (Enrollment / Roll No: <strong>${escapeHtml(data.enrollmentNo || '—')}</strong>) is a bonafide student of the School of Data Science and Forecasting, Devi Ahilya Vishwavidyalaya, Indore, pursuing <strong>${escapeHtml(data.course || data.studentCourse)}</strong> (${escapeHtml(data.semester || data.studentSemester || 'Sem I')}).
                    </p>

                    <p style="margin-bottom: 18px;">
                        The candidate is hereby granted <strong>OFFICIAL PERMISSION</strong> to join and undergo an internship program at <strong>${escapeHtml(data.companyName)}</strong> (${escapeHtml(data.internshipMode || 'Off-Campus')}) for the current academic session.
                    </p>

                    <p style="margin-bottom: 18px;">
                        During the period of internship, the student will abide by all rules, academic discipline, and code of conduct of both the host organization and the university.
                    </p>

                    <p style="margin-bottom: 18px;">
                        We wish the student all success in their internship endeavor.
                    </p>
                </div>

                <div class="noc-letter-footer" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; padding-top: 20px;">
                    <div>
                        <div style="width: 170px; border-top: 1px solid #64748b; margin-bottom: 5px;"></div>
                        <p style="margin: 0; font-size: 13px; font-weight: bold;">Signature of Student</p>
                        <p style="margin: 0; font-size: 12px; color: #555;">Student Name: <strong>${escapeHtml(data.studentName)}</strong></p>
                    </div>
                    <div style="text-align: right;">
                        <div style="width: 190px; margin-left: auto; border-top: 1.5px solid #0f172a; margin-bottom: 5px;"></div>
                        <p style="margin: 0; font-weight: bold; font-size: 14px; text-transform: uppercase;">Head of Department</p>
                        <p style="margin: 0; font-size: 12.5px; color: #475569;">School of Data Science & Forecasting</p>
                        <p style="margin: 0; font-size: 12px; color: #475569;">DAVV, Indore</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };

    window.closePrintableOffer = function () {
        const modal = document.getElementById("printableOfferModal");
        if (modal) modal.remove();
    };

    // Show printable/downloadable NOC Letter modal
    window.showPrintableNoc = function () {
        const savedData = localStorage.getItem("sdsf_student_noc");
        const data = savedData ? JSON.parse(savedData) : {
            id: "NOC-1092",
            studentName: "Student Name",
            studentCourse: "M.Sc. Data Science & Analytics",
            studentSemester: "Sem III",
            companyName: "Organization",
            internshipMode: "Off Campus",
            date: new Date().toLocaleDateString()
        };

        const isDisapproved = data.status === "Rejected" || data.status === "Disapproved";

        const modal = document.createElement("div");
        modal.className = "printable-noc-overlay";
        modal.id = "printableNocModal";
        modal.onclick = function (e) {
            if (e.target === modal) closePrintableNoc();
        };
        modal.innerHTML = `
            <div class="printable-noc-paper" style="font-family: 'Times New Roman', serif; max-width: 820px; padding: 45px 50px;" onclick="event.stopPropagation()">
                <div class="noc-print-actions" style="margin-bottom: 25px;">
                    <button onclick="window.print()" style="background: ${isDisapproved ? '#ef4444' : '#1e3a8a'}; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;"><i class="fas fa-print"></i> Print / Save as PDF</button>
                    <button onclick="closePrintableNoc()" style="background: #64748b; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">Close</button>
                </div>

                <!-- Letterhead with Dual Logos -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">
                    <img src="/photoes/davvLogo.png" alt="DAVV Logo" style="height: 70px; width: auto; object-fit: contain;">
                    <div style="text-align: center; flex-grow: 1;">
                        <h2 style="font-family: 'Times New Roman', serif; margin: 0; font-size: 18px; font-weight: bold; color: #1e3a8a; text-transform: uppercase;">DEVI AHILYA VISHWAVIDYALAYA, INDORE</h2>
                        <h3 style="font-family: 'Times New Roman', serif; margin: 3px 0; font-size: 14.5px; font-weight: bold; color: #0f172a; text-transform: uppercase;">SCHOOL OF DATA SCIENCE AND FORECASTING (SDSF)</h3>
                        <p style="font-size: 11.5px; margin: 0; font-style: italic; color: #475569;">Takshila Campus, Khandwa Road, Indore – 452001 (M.P.)</p>
                    </div>
                    <img src="/photoes/departmentlogo_transparent.png" alt="SDSF Logo" style="height: 70px; width: auto; object-fit: contain;">
                </div>

                <div style="height: 3px; background: #1e3a8a; margin-top: 2px; margin-bottom: 16px;"></div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 13.5px; font-weight: 600;">
                    <div>Ref No: SDSF/NOC/2026/${data.id || 'NOC-101'}</div>
                    <div>Date: ${data.date}</div>
                </div>

                ${isDisapproved ? `
                    <div style="border-top: 1.5px solid #dc2626; border-bottom: 1.5px solid #dc2626; padding: 8px 0; margin-bottom: 22px; text-align: center;">
                        <h4 style="font-size: 15.5px; font-weight: bold; color: #dc2626; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
                            NOTICE OF NOC DISAPPROVAL
                        </h4>
                    </div>

                    <div class="noc-letter-body" style="font-size: 14.5px; line-height: 1.85; text-align: justify;">
                        <p>This is to inform that the No Objection Certificate (NOC) application submitted by <strong>${escapeHtml(data.studentName)}</strong> (Enrollment / Roll No: <strong>${escapeHtml(data.enrollmentNo || '—')}</strong>), a bonafide student of the School of Data Science and Forecasting, Devi Ahilya Vishwavidyalaya, Indore, pursuing <strong>${escapeHtml(data.course || data.studentCourse)}</strong> (${escapeHtml(data.semester || data.studentSemester || 'Sem I')}), has been <strong>REVIEWED AND DISAPPROVED</strong> by the SDSF Faculty Cell.</p>

                        <p>The Department currently has <strong>DISAPPROVED / WITHHELD OBJECTION PERMISSION</strong> for the candidate to undergo the requested internship program at <strong>${escapeHtml(data.companyName)}</strong> (${escapeHtml(data.internshipMode || 'Off-Campus')}).</p>

                        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-left: 4px solid #ef4444; padding: 12px 15px; border-radius: 4px; font-weight: 500; color: #991b1b; margin: 15px 0;">
                            <strong>Status:</strong> APPLICATION DISAPPROVED BY FACULTY AUTHORITY
                        </div>

                        <p>The candidate may contact the Head of Department or SDSF Internship Cell for clarification or resubmit a fresh NOC application if necessary.</p>
                    </div>
                ` : `
                    <div style="border-top: 1.5px solid #1e3a8a; border-bottom: 1.5px solid #1e3a8a; padding: 8px 0; margin-bottom: 22px; text-align: center;">
                        <h4 style="font-size: 15.5px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
                            OFFICIAL NO OBJECTION CERTIFICATE (NOC)
                        </h4>
                    </div>

                    <div class="noc-letter-body" style="font-size: 14.5px; line-height: 1.85; text-align: justify;">
                        <p style="margin-bottom: 18px;">
                            This is to certify that <strong>${escapeHtml(data.studentName)}</strong> (Enrollment / Roll No: <strong>${escapeHtml(data.enrollmentNo || '—')}</strong>) is a bonafide student of the School of Data Science and Forecasting, Devi Ahilya Vishwavidyalaya, Indore, pursuing <strong>${escapeHtml(data.course || data.studentCourse)}</strong> (${escapeHtml(data.semester || data.studentSemester || 'Sem I')}).
                        </p>

                        <p style="margin-bottom: 18px;">
                            The Department has <strong>NO OBJECTION</strong> for the candidate to undergo an internship program at <strong>${escapeHtml(data.companyName)}</strong> (${escapeHtml(data.internshipMode || 'Off-Campus')}) for the current academic session.
                        </p>

                        <p style="margin-bottom: 18px;">
                            During the period of internship, the student will abide by all rules, academic discipline, and code of conduct of both the host organization and the university.
                        </p>

                        <p style="margin-bottom: 18px;">
                            We wish the student all success in their internship endeavor.
                        </p>
                    </div>
                `}

                <div class="noc-letter-footer" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; padding-top: 20px;">
                    <div>
                        <div style="width: 170px; border-top: 1px solid #64748b; margin-bottom: 5px;"></div>
                        <p style="margin: 0; font-size: 13px; font-weight: bold;">Signature of Student</p>
                        <p style="margin: 0; font-size: 12px; color: #555;">Student Name: <strong>${escapeHtml(data.studentName)}</strong></p>
                    </div>
                    <div style="text-align: right;">
                        <div style="width: 190px; margin-left: auto; border-top: 1.5px solid #0f172a; margin-bottom: 5px;"></div>
                        <p style="margin: 0; font-weight: bold; font-size: 14px; text-transform: uppercase;">Head of Department</p>
                        <p style="margin: 0; font-size: 12.5px; color: #475569;">School of Data Science & Forecasting</p>
                        <p style="margin: 0; font-size: 12px; color: #475569;">DAVV, Indore</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };

    window.closePrintableOffer = function () {
        const modals = document.querySelectorAll("#printableOfferModal, .printable-noc-overlay");
        modals.forEach(m => m.remove());
    };

    window.closePrintableNoc = function () {
        const modals = document.querySelectorAll("#printableNocModal, .printable-noc-overlay");
        modals.forEach(m => m.remove());
    };

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // Back to Top button
    const backToTopBtn = document.getElementById("sdsfBackToTop");
    if (backToTopBtn) {
        backToTopBtn.addEventListener("click", function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
});
