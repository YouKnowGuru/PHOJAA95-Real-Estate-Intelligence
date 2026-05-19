import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM || "noreply@phojaa95.com";
  
  await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
  appUrl: string = "http://localhost:5173"
): Promise<void> {
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
  
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
        If you didn't request this password reset, please ignore this email or contact support if you have concerns.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        This is an automated message from PHOJAA95 Real Estate System. Please do not reply to this email.
      </p>
    </div>
  `;
  
  await sendEmail({
    to,
    subject: "Password Reset - PHOJAA95 Real Estate",
    html,
  });
}

export async function sendApprovalNotificationEmail(
  to: string,
  propertyName: string,
  step: number,
  approved: boolean,
  comments?: string
): Promise<void> {
  const status = approved ? "Approved" : "Rejected";
  const statusColor = approved ? "#10b981" : "#ef4444";
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${statusColor};">Property ${status}</h2>
      <p>Your property submission "<strong>${propertyName}</strong>" - Step ${step} has been ${status.toLowerCase()}.</p>
      ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ""}
      <p style="color: #666; font-size: 14px;">
        Please log in to the PHOJAA95 Real Estate System to view details and proceed.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        This is an automated message from PHOJAA95 Real Estate System. Please do not reply to this email.
      </p>
    </div>
  `;
  
  await sendEmail({
    to,
    subject: `Property "${propertyName}" - Step ${step} ${status}`,
    html,
  });
}
