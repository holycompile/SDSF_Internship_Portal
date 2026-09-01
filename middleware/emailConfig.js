require("dotenv").config();

/**
 * Send 6-digit verification code email to student
 * @param {Object} params
 * @param {string} params.toEmail - Recipient student email
 * @param {string} params.studentName - Name of the student
 * @param {string} params.verificationCode - 6-digit code
 * @returns {Promise<Object>} result
 */
const sendVerificationEmail = async ({ toEmail, studentName, verificationCode }) => {
  if (!toEmail) {
    console.warn("sendVerificationEmail: No recipient email provided. Skipping email dispatch.");
    return { success: false, message: "No recipient email provided." };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "SDSF Internship Portal - DAVV",
          email: process.env.SMTP_USER || "joyobratadas.85912@gmail.com",
        },
        to: [
          {
            email: toEmail,
            name: studentName || "Student",
          },
        ],
        subject: "SDSF Internship Portal - Student Verification Code",
        textContent: `Dear ${studentName || "Student"},\n\nYour 6-digit verification code for the SDSF Student Internship Portal is: ${verificationCode}\n\nPlease enter this code to complete your verification.\n\nBest regards,\nSchool of Data Science and Forecasting (SDSF)\nDAVV Indore`,
        htmlContent: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 20px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="background-color: #16223e; color: #ffffff; padding: 20px 24px; text-align: center; border-bottom: 4px solid #f2b300;">
              <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">SDSF DAVV Indore</h2>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Student Internship Portal Verification</p>
            </div>
            
            <div style="padding: 28px 24px;">
              <p style="font-size: 15px; color: #334155; margin-top: 0;">Dear <strong>${studentName || "Student"}</strong>,</p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                We received a request to verify your student enrollment on the SDSF Internship Portal. Use the verification code below to proceed:
              </p>
              
              <div style="margin: 24px 0; text-align: center;">
                <div style="display: inline-block; background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 14px 28px; font-size: 28px; font-family: monospace; font-weight: bold; letter-spacing: 6px; color: #1d4ed8;">
                  ${verificationCode}
                </div>
                <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Valid for single-session verification</p>
              </div>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                If you did not initiate this verification, please contact the SDSF department administrator immediately.
              </p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 14px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
              © School of Data Science and Forecasting, Devi Ahilya Vishwavidyalaya, Indore.
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Email Error] Brevo failed to send email:", errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log(`[Email Sent] Verification code dispatched to ${toEmail} | MessageID: ${data.messageId}`);
    return { success: true, messageId: data.messageId };
  } catch (err) {
    console.error("[Email Error] Failed to send verification email:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendVerificationEmail,
};