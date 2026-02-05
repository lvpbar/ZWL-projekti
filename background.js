// background.js (Manifest V3 service worker)
const DEFAULT_EMAIL_SUBJECT = "Test email";

async function getAccessToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (!token || chrome.runtime.lastError) reject(chrome.runtime.lastError || new Error("No token"));
      else resolve(token);
    });
  });
}

function buildMime({ to, subject, htmlBody }) {
  return `To: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${htmlBody}`;
}

function base64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendEmail({ to, subject, htmlBody, token }) {
  const raw = base64urlEncode(buildMime({ to, subject, htmlBody }));
  const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// MESSAGE LISTENER
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "sendBulkEmails") {
    handleBulkSend(message.subject)
      .then(() => sendResponse({ status: "ok" }))
      .catch((err) => sendResponse({ status: "error", message: err.message }));
    return true; // async
  }
  if (message.action === "sendTestEmail") {
    handleTestSend(message.subject)
      .then(() => sendResponse({ status: "ok" }))
      .catch((err) => sendResponse({ status: "error", message: err.message }));
    return true; // async
  }
});

// BULK SEND
async function handleBulkSend(subject) {
  const token = await getAccessToken(true);
  const { csvContent, htmlContent } = await chrome.storage.local.get(["csvContent", "htmlContent"]);
  if (!csvContent || !htmlContent) throw new Error("CSV or HTML template not loaded");

  const rows = csvContent.trim().split(/\r?\n/).slice(1).map(line => {
    const [email, name] = line.split(",");
    return { email: email?.trim(), name: name?.trim() || "" };
  });

  for (const row of rows) {
    if (!row.email) continue;
    const personalizedHTML = htmlContent.replace(/{{\s*name\s*}}/gi, row.name);
    await sendEmail({ to: row.email, subject: subject || DEFAULT_EMAIL_SUBJECT, htmlBody: personalizedHTML, token });
    await new Promise(r => setTimeout(r, 1500));
  }
}

// TEST EMAIL SEND
async function handleTestSend(subject) {
  const token = await getAccessToken(true);
  const { htmlContent } = await chrome.storage.local.get(["htmlContent"]);
  if (!htmlContent) throw new Error("HTML template not loaded");

  const testEmail = "your-email@example.com"; // CHANGE TO REAL TEST EMAIL
  await sendEmail({ to: testEmail, subject: subject || DEFAULT_EMAIL_SUBJECT, htmlBody: htmlContent, token });
}
