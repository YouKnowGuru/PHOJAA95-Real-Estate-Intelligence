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
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 40px 32px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <div style="display: inline-block; width: 56px; height: 56px; background: rgba(16, 185, 129, 0.15); border-radius: 14px; margin-bottom: 16px; text-align: center; line-height: 56px;">
                      <span style="font-size: 28px;">🔐</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.5px;">Password Reset</h1>
                    <p style="color: #94a3b8; font-size: 14px; margin: 0;">PHOJAA95 Real Estate System</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi there,
              </p>
              <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 32px;">
                We received a request to reset the password for your PHOJAA95 Real Estate account. Click the button below to create a new password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 15px; font-weight: 600; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 0 0 32px; word-break: break-all;">
                <a href="${resetUrl}" style="color: #10b981; font-size: 13px; text-decoration: none; font-family: monospace;">${resetUrl}</a>
              </p>

              <!-- Security Box -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="28" valign="top" style="padding-right: 12px;">
                          <span style="font-size: 18px;">⏱️</span>
                        </td>
                        <td>
                          <p style="color: #92400e; font-size: 13px; line-height: 1.5; margin: 0; font-weight: 500;">
                            This link expires in 1 hour for security reasons.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #f1f5f9;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0 0 8px;">
                This is an automated security message from PHOJAA95 Real Estate System.
              </p>
              <p style="color: #cbd5e1; font-size: 11px; line-height: 1.5; margin: 0;">
                Please do not reply to this email. If you need help, contact your system administrator.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await sendEmail({
    to,
    subject: "Reset Your Password — PHOJAA95 Real Estate",
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
  const statusBg = approved ? "#ecfdf5" : "#fef2f2";
  const statusBorder = approved ? "#a7f3d0" : "#fecaca";
  const emoji = approved ? "✅" : "❌";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Property ${status}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 40px 32px; text-align: center;">
              <div style="display: inline-block; width: 56px; height: 56px; background: ${approved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border-radius: 14px; margin-bottom: 16px; text-align: center; line-height: 56px;">
                <span style="font-size: 28px;">${emoji}</span>
              </div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.5px;">Property ${status}</h1>
              <p style="color: #94a3b8; font-size: 14px; margin: 0;">PHOJAA95 Real Estate System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${statusBg}; border: 1px solid ${statusBorder}; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
                      <strong>Property:</strong> ${propertyName}
                    </p>
                    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
                      <strong>Step:</strong> ${step}
                    </p>
                    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">
                      <strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${status}</span>
                    </p>
                  </td>
                </tr>
              </table>

              ${comments ? `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="color: #475569; font-size: 13px; font-weight: 600; margin: 0 0 6px;">Reviewer Comments</p>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">${comments}</p>
                  </td>
                </tr>
              </table>
              ` : ""}

              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">
                Please log in to the PHOJAA95 Real Estate System to view full details and proceed with the next steps.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0;">
                This is an automated notification from PHOJAA95 Real Estate System. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await sendEmail({
    to,
    subject: `${emoji} Property "${propertyName}" — Step ${step} ${status}`,
    html,
  });
}
