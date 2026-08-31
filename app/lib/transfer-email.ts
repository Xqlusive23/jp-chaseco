import { receiptHeadline, receiptSubcopy, statusLabel } from "./activity";
import { publicBankLogoUrl } from "./email-images";
import { EMAIL_NAVY, emailContactCta, emailHeader, emailRow, emailShell } from "./email-layout";
import { p2pEmailHtml } from "./p2p-email";
import { formatLongDate, formatMoneyUsd, shortId } from "./format";
import type { TransferNotice } from "./notify-transfer";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusColors(status: TransferNotice["status"]) {
  if (status === "hold") return { bg: "#fff4e8", border: "#c2410c", text: "#9a3412" };
  if (status === "pending") return { bg: "#fff7ed", border: "#d97706", text: "#9a3412" };
  if (status === "processing") return { bg: "#e8f2fc", border: "#1366d6", text: "#0b4f9c" };
  return { bg: "#ecfdf5", border: "#0f766e", text: "#115e59" };
}

function methodLabel(notice: TransferNotice) {
  if (notice.transferType === "wire") return "Wire transfer";
  if (notice.transferType === "ach") return "ACH transfer";
  if (notice.transferType === "bill") return "Bill pay";
  if (notice.transferType === "deposit") return "Mobile deposit";
  if (notice.transferType === "p2p") return "Zelle®";
  return "Transfer";
}

function safeDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return formatLongDate(new Date());
  return formatLongDate(date);
}

export function transferEmailHtml(notice: TransferNotice, supportUrl: string) {
  if (notice.transferType === "p2p") return p2pEmailHtml(notice, supportUrl);

  const status = statusLabel(notice.status);
  const amount = formatMoneyUsd(notice.amount);
  const colors = statusColors(notice.status);
  const brand = escapeHtml(notice.brandName);
  const recipient = escapeHtml(notice.recipientName);
  const sender = escapeHtml(notice.senderName);
  const bank = escapeHtml(notice.bankName || "Receiving bank");
  const date = escapeHtml(safeDate(notice.date));
  const txn = escapeHtml(shortId(notice.transactionId));
  const contact = notice.supportHref || supportUrl;
  const fee = notice.fee ? formatMoneyUsd(notice.fee) : "";
  const bankSrc = escapeHtml(notice.bankLogo || publicBankLogoUrl(notice.bankName));

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${colors.bg}" style="background-color:${colors.bg};border-left:4px solid ${colors.border};border-radius:10px;">
      <tr>
        <td style="padding:16px 18px;color:${colors.text};">
          <p style="margin:0;font-size:18px;font-weight:700;color:${colors.text};">${escapeHtml(receiptHeadline(notice.status))}</p>
          <p style="margin:6px 0 0;font-size:14px;color:${colors.text};">${escapeHtml(receiptSubcopy(notice.status))}</p>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:14px;color:#717171;">${sender} sent</p>
    <p style="margin:6px 0 0;font-size:28px;line-height:1.2;font-weight:700;color:#0b1f3a;">${amount}</p>
    <p style="margin:8px 0 0;font-size:14px;color:#717171;">${escapeHtml(methodLabel(notice))} · ${escapeHtml(status)}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="margin-top:24px;background-color:#f8fafc;border:1px solid #e4e8ee;border-radius:12px;">
      <tr>
        <td style="padding:16px;">
          <img src="${bankSrc}" alt="${bank}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:8px;border:1px solid #e4e8ee;background-color:#ffffff;" />
          <p style="margin:10px 0 0;font-size:11px;color:#717171;text-transform:uppercase;letter-spacing:0.06em;">Recipient bank</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0b1f3a;">${bank}</p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      ${emailRow("To", recipient, "font-weight:600;")}
      ${emailRow("Date", date)}
      ${emailRow("Transaction ID", txn)}
      ${notice.routingNumber ? emailRow("Routing number", escapeHtml(notice.routingNumber)) : ""}
      ${fee ? emailRow("Fee", fee) : ""}
      ${emailRow("Status", escapeHtml(status), `color:${colors.text};font-weight:700;`)}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e7f1fb" style="margin-top:24px;background-color:#e7f1fb;border-radius:12px;">
      <tr>
        <td style="padding:18px;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#0b1f3a;">Need help?</p>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#334155;">If you have a question about this transfer, or you did not expect this payment, tap Contact us and we will look into it.</p>
          ${emailContactCta(contact)}
        </td>
      </tr>
    </table>
  `;

  const footer = `This notice was sent by ${brand} because a transfer was addressed to you.${
    notice.intendedRecipient ? ` Originally addressed to ${escapeHtml(notice.intendedRecipient)}.` : ""
  }`;

  return emailShell(emailHeader("Transfer notice", notice.brandName, notice.brandNameCid, notice.brandMarkCid, EMAIL_NAVY), body, footer, EMAIL_NAVY);
}
