import nodemailer from "nodemailer";

function createTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail({ to, subject, html }) {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  if (!transporter || !from) {
    return { sent: false, error: "Email is not configured" };
  }

  try {
    await transporter.sendMail({ from, to, subject, html });
    return { sent: true };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { sent: false, error: error.message };
  }
}

export async function sendPasswordSetupEmail({ to, link, userName, type }) {
  const isInvite = type === "invite";
  const subject = isInvite
    ? "You're invited to PaperFlow ERP"
    : "Reset your PaperFlow ERP password";

  const html = `
    <p>Hello ${userName},</p>
    <p>${
      isInvite
        ? "An administrator created an account for you. Set your password using the link below:"
        : "Use the link below to set a new password:"
    }</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in 48 hours.</p>
  `;

  return sendEmail({ to, subject, html });
}
