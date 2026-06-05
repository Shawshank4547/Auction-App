const nodemailer = require('nodemailer');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Reuse a single transporter (nodemailer recommends this for performance)
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,       // your Gmail address e.g. you@gmail.com
      pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not your login password)
    },
  });

  return transporter;
};

/**
 * Generate a 6-digit OTP and expiry (10 minutes from now)
 */
const generateOTP = () => {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { code, expiresAt };
};

/**
 * Send OTP email to user
 */
const sendOTPEmail = async (toEmail, name, otp) => {
  try {
    const transport = getTransporter();

    await transport.sendMail({
      from: `"AuctionPro" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: 'Your AuctionPro verification code',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; background: #111827; color: #f9fafb; border-radius: 12px; overflow: hidden;">
          <div style="background: #2563eb; padding: 32px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; color: white;">AuctionPro</h1>
          </div>
          <div style="padding: 32px;">
            <p style="margin: 0 0 16px; font-size: 16px;">Hi ${name},</p>
            <p style="margin: 0 0 24px; color: #9ca3af;">Your one-time verification code is:</p>
            <div style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #60a5fa; font-family: monospace;">${otp}</span>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">This code expires in <strong style="color: #f9fafb;">10 minutes</strong>. Do not share it with anyone.</p>
          </div>
        </div>
      `,
    });

    logger.info(`OTP email sent to ${toEmail}`);
    return true;
  } catch (err) {
    logger.error('Failed to send OTP email:', err);
    return false;
  }
};

module.exports = { generateOTP, sendOTPEmail };