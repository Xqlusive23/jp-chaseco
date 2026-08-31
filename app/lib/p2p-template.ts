export type P2pEmailTemplate = {
  subject: string;
  eyebrow: string;
  intro: string;
  amountLine: string;
  footer: string;
  headerColor: string;
  nameImage: string;
  contactNote: string;
};

export const DEFAULT_P2P_EMAIL: P2pEmailTemplate = {
  subject: "{{sender}} sent you {{amount}}",
  eyebrow: "You received money",
  intro: "Hi {{firstName}},\nYou received money.",
  amountLine: "{{sender}} sent you",
  footer: "This payment notice was sent by {{brand}}. If you did not expect this, tap Contact us.",
  headerColor: "#0b5cab",
  nameImage: "",
  contactNote: "If you did not expect this payment, tap Contact us.",
};

export const P2P_PLACEHOLDERS = [
  "{{sender}}",
  "{{recipient}}",
  "{{firstName}}",
  "{{amount}}",
  "{{memo}}",
  "{{brand}}",
  "{{date}}",
  "{{status}}",
  "{{ref}}",
] as const;

const TOKEN = /\{\{\s*(sender|recipient|firstname|amount|memo|brand|date|status|ref)\s*\}\}/gi;

export type P2pTemplateVars = {
  sender: string;
  recipient: string;
  firstName: string;
  amount: string;
  memo: string;
  brand: string;
  date: string;
  status: string;
  ref: string;
};

export function firstNameFrom(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] || "there";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitizeHeaderColor(value?: string) {
  const hex = value?.trim() || "";
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : DEFAULT_P2P_EMAIL.headerColor;
}

export function normalizeP2pEmail(value?: Partial<P2pEmailTemplate> | null): P2pEmailTemplate {
  return {
    subject: value?.subject?.trim() || DEFAULT_P2P_EMAIL.subject,
    eyebrow: value?.eyebrow?.trim() || DEFAULT_P2P_EMAIL.eyebrow,
    intro: value?.intro?.trim() || DEFAULT_P2P_EMAIL.intro,
    amountLine: value?.amountLine?.trim() || DEFAULT_P2P_EMAIL.amountLine,
    footer: value?.footer?.trim() || DEFAULT_P2P_EMAIL.footer,
    headerColor: sanitizeHeaderColor(value?.headerColor),
    nameImage: value?.nameImage || "",
    contactNote: value?.contactNote ?? DEFAULT_P2P_EMAIL.contactNote,
  };
}

export function p2pTemplateBlocked(template: P2pEmailTemplate) {
  const text = [template.subject, template.eyebrow, template.intro, template.amountLine, template.footer, template.contactNote].join(" ").toLowerCase();
  if (/\bzelle\b/.test(text) || /\bchase\b/.test(text) || /jpmorgan|jp\s*morgan/.test(text)) {
    return "That wording is not allowed on Zelle emails.";
  }
  return "";
}

export function fillP2pText(template: string, vars: P2pTemplateVars) {
  const clean = template.replace(/[<>]/g, "");
  return clean.replace(TOKEN, (_, key: string) => {
    const name = key.toLowerCase() === "firstname" ? "firstName" : key.toLowerCase();
    return vars[name as keyof P2pTemplateVars] ?? "";
  });
}

export function fillP2pHtml(template: string, vars: P2pTemplateVars) {
  const escaped: P2pTemplateVars = {
    sender: escapeHtml(vars.sender),
    recipient: escapeHtml(vars.recipient),
    firstName: escapeHtml(vars.firstName),
    amount: escapeHtml(vars.amount),
    memo: escapeHtml(vars.memo),
    brand: escapeHtml(vars.brand),
    date: escapeHtml(vars.date),
    status: escapeHtml(vars.status),
    ref: escapeHtml(vars.ref),
  };
  return fillP2pText(template, escaped);
}
