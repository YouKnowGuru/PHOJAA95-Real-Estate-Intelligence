// Test script for forgot password email functionality
require("dotenv/config");
const nodemailer = require("nodemailer");

async function testEmail() {
  console.log("=== Email Configuration Test ===\n");

  // Show current env values (mask password)
  console.log("SMTP_HOST:", process.env.SMTP_HOST || "(not set)");
  console.log("SMTP_PORT:", process.env.SMTP_PORT || "(not set)");
  console.log("SMTP_USER:", process.env.SMTP_USER || "(not set)");
  console.log("SMTP_PASS:", process.env.SMTP_PASS ? "***SET***" : "(not set)");
  console.log("SMTP_FROM:", process.env.SMTP_FROM || "(not set)");
  console.log("APP_URL:", process.env.APP_URL || "(not set)");
  console.log("");

  // Create transporter (same as email.ts)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Verify connection
  console.log("1. Testing SMTP connection...");
  try {
    await transporter.verify();
    console.log("   ✅ SMTP connection successful\n");
  } catch (err) {
    console.error("   ❌ SMTP connection failed:", err.message);
    console.error("   Code:", err.code);
    process.exit(1);
  }

  // Build reset URL
  const token = "test-token-12345";
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  console.log("2. Reset URL would be:", resetUrl);
  console.log("   (Make sure this URL is correct!)\n");

  // Send test email
  const testEmail = process.env.SMTP_USER;
  console.log(`3. Sending test password reset email to: ${testEmail}...`);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">Password Reset Request</h2>
      <p>You requested a password reset for your PHOJAA95 Real Estate account.</p>
      <p>Click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">
        This link will expire in 1 hour for security reasons.
      </p>
      <p style="color: #666; font-size: 14px;">
        If you didn't request this password reset, please ignore this email.
      </p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@phojaa95.com",
      to: testEmail,
      subject: "[TEST] Password Reset - PHOJAA95 Real Estate",
      html,
    });
    console.log("   ✅ Email sent successfully!");
    console.log("   Message ID:", info.messageId);
    console.log("   Accepted:", info.accepted);
    console.log("   Rejected:", info.rejected);
  } catch (err) {
    console.error("   ❌ Failed to send email:", err.message);
    console.error("   Code:", err.code);
    if (err.response) console.error("   Response:", err.response);
    process.exit(1);
  }

  console.log("\n=== Test Complete ===");
}

testEmail();
