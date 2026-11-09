import nodemailer from 'nodemailer';
import { dbService, Message } from './db.js';

export async function sendEmailNotification(
  message: Message,
  roomDetails?: { user_name: string; user_email: string },
  recipientOverride?: string
) {
  const settings = dbService.getSettings();
  const adminEmail = settings.admin_email || 'mesakibu4@gmail.com';
  const siteName = settings.site_name || 'Sakib Hasan Live';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  // Determine recipient:
  // If user sent it -> recipient is admin (Sakib Hasan: mesakibu4@gmail.com)
  // If admin sent it -> recipient is visitor's email
  const isFromUser = message.sender_type === 'user';
  const recipient = recipientOverride || (isFromUser ? adminEmail : (roomDetails?.user_email || message.sender_email || ''));

  if (!recipient || recipient === 'visitor@guest.com' || recipient === 'anonymous@visitor.com') {
    return { success: false, reason: 'No valid recipient email' };
  }

  const senderName = message.sender_name || (isFromUser ? 'Visitor' : 'Sakib Hasan');
  const senderEmail = message.sender_email || (isFromUser ? 'visitor@guest.com' : adminEmail);
  const actionUrl = isFromUser ? `${appUrl}/join?room=${message.room_id}` : `${appUrl}?room=${message.room_id}`;

  let typeBadge = '💬 Message';
  let previewText = message.text || '';

  if (message.message_type === 'audio') {
    typeBadge = '🎙️ Voice Note';
    previewText = `🎙️ Voice Note (${message.file_name || 'Audio message'})`;
  } else if (message.message_type === 'image') {
    typeBadge = '📷 Photo';
    previewText = `📷 Photo attachment: ${message.file_name || 'Image'}`;
  } else if (message.message_type === 'file') {
    typeBadge = '📎 File';
    previewText = `📎 File attachment: ${message.file_name || 'Document'}`;
  } else if (message.message_type === 'call_log') {
    typeBadge = '📞 Call';
    previewText = `📞 Call notification: ${message.text || 'Call session'}`;
  }

  const subject = isFromUser
    ? `[${siteName}] ${typeBadge} from ${senderName} (${senderEmail})`
    : `[${siteName}] Reply from Sakib Hasan`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; margin: 0; }
        .card { background-color: #0d0d0d; border: 1px solid #27272a; border-radius: 16px; padding: 28px; max-width: 580px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
        .header { border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 20px; }
        .title { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 6px 0; }
        .subtitle { color: #a1a1aa; font-size: 13px; margin: 0; }
        .message-box { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 15px; line-height: 1.6; color: #ffffff; white-space: pre-wrap; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; color: #a1a1aa; }
        .meta-table td { padding: 6px 0; }
        .meta-table td.label { color: #71717a; width: 120px; }
        .badge { display: inline-block; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; color: #ffffff; }
        .btn { display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; padding: 12px 26px; border-radius: 10px; font-weight: 600; font-size: 13px; text-align: center; }
        .footer { text-align: center; font-size: 11px; color: #71717a; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 class="title">${siteName}</h2>
          <p class="subtitle">${isFromUser ? `A visitor sent you a ${typeBadge.toLowerCase()} via the live portal.` : 'Sakib Hasan replied to your conversation.'}</p>
        </div>

        <table class="meta-table">
          <tr>
            <td class="label">Type:</td>
            <td><span class="badge">${typeBadge}</span></td>
          </tr>
          <tr>
            <td class="label">From:</td>
            <td><strong>${senderName}</strong> (${senderEmail})</td>
          </tr>
          <tr>
            <td class="label">To:</td>
            <td><strong>${recipient}</strong></td>
          </tr>
          <tr>
            <td class="label">Date:</td>
            <td>${new Date(message.created_at).toLocaleString()}</td>
          </tr>
        </table>

        <div class="message-box">${previewText}</div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${actionUrl}" class="btn">Open Realtime Chat to Reply →</a>
        </div>

        <div class="footer">
          Direct Mail-to-Mail Synchronized Transmission · Sakib Hasan Platform
        </div>
      </div>
    </body>
    </html>
  `;

  const logId = 'email_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const smtpEnabled = settings.smtp_enabled === 'true' && settings.smtp_user && settings.smtp_pass;

  if (smtpEnabled) {
    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host || 'smtp.gmail.com',
        port: parseInt(settings.smtp_port || '587', 10),
        secure: settings.smtp_port === '465',
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_pass,
        },
      });

      await transporter.sendMail({
        from: `"${siteName}" <${settings.smtp_user}>`,
        to: recipient,
        replyTo: senderEmail,
        subject,
        html: htmlContent,
      });

      dbService.logEmail({
        id: logId,
        message_id: message.id,
        room_id: message.room_id,
        recipient,
        sender_name: senderName,
        subject,
        content_preview: previewText,
        status: 'sent',
        details: `Delivered via SMTP (${settings.smtp_host})`,
        created_at: new Date().toISOString(),
      });
      return { success: true, status: 'sent' };
    } catch (err: any) {
      console.error('SMTP Delivery error:', err.message);
      dbService.logEmail({
        id: logId,
        message_id: message.id,
        room_id: message.room_id,
        recipient,
        sender_name: senderName,
        subject,
        content_preview: previewText,
        status: 'error',
        details: `SMTP error: ${err.message}`,
        created_at: new Date().toISOString(),
      });
      return { success: false, status: 'error', error: err.message };
    }
  } else {
    // Queued & dispatched logging for direct mail-to-mail audit trail
    dbService.logEmail({
      id: logId,
      message_id: message.id,
      room_id: message.room_id,
      recipient,
      sender_name: senderName,
      subject,
      content_preview: previewText,
      status: 'simulated',
      details: `Direct mail-to-mail notification routed to ${recipient}. All visitor messages (text, voice, files) trigger email notifications.`,
      created_at: new Date().toISOString(),
    });
    return { success: true, status: 'simulated' };
  }
}
