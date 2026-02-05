document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const status = $("statusMessage");
  const authBtn = $("googleAuthBtn");
  const sendBtn = $("sendEmailsBtn");
  const csvBtn = $("editCsvBtn");
  const htmlBtn = $("editTemplateBtn");
  const previewBtn = $("previewBtn");
  const sendTestBtn = $("sendTestBtn");
  const subjectInput = $("subjectInput");

  const csvInput = $("csvInput");
  const htmlInput = $("htmlInput");

  let isAuthed = false;
  let hasCSV = false;
  let hasHTML = false;

  const setStatus = (msg) => (status.textContent = msg);

  const updateButtons = () => {
    const enabled =
      isAuthed &&
      hasCSV &&
      hasHTML &&
      subjectInput.value.trim().length > 0;

    sendBtn.disabled = !enabled;
    sendBtn.style.opacity = enabled ? "1" : "0.5";
  };

  updateButtons();

  // GOOGLE AUTH
  authBtn.addEventListener("click", () => {
    setStatus("🔐 Connecting...");
    chrome.identity.getAuthToken({ interactive: false }, (oldToken) => {
      if (oldToken) chrome.identity.removeCachedAuthToken({ token: oldToken }, auth);
      else auth();
    });

    function auth() {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (!token || chrome.runtime.lastError) {
          setStatus("❌ Login cancelled");
          return;
        }
        fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: "Bearer " + token },
        })
          .then(r => r.json())
          .then(u => {
            isAuthed = true;
            setStatus(`Connected as ${u.email}`);
            updateButtons();
          })
          .catch(() => {
            isAuthed = true;
            setStatus("Connected");
            updateButtons();
          });
      });
    }
  });

  // FILE PICKERS
  csvBtn.addEventListener("click", () => csvInput.click());
  htmlBtn.addEventListener("click", () => htmlInput.click());

  csvInput.addEventListener("change", () => {
    readFile(csvInput.files[0], "csvContent");
    hasCSV = true;
    setStatus("CSV loaded");
    updateButtons();
  });

  htmlInput.addEventListener("change", () => {
    readFile(htmlInput.files[0], "htmlContent");
    hasHTML = true;
    setStatus("HTML template loaded");
    updateButtons();
  });

  subjectInput.addEventListener("input", updateButtons);

  function readFile(file, key) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => chrome.storage.local.set({ [key]: reader.result });
    reader.readAsText(file);
  }

  // PREVIEW
  previewBtn.addEventListener("click", () => {
    chrome.storage.local.get(["htmlContent"], (data) => {
      if (!data.htmlContent) {
        setStatus("❌ No HTML template loaded");
        return;
      }
      const previewUrl = "data:text/html;charset=utf-8," + encodeURIComponent(data.htmlContent);
      chrome.tabs.create({ url: previewUrl });
    });
  });

  // SEND TEST EMAIL
  sendTestBtn.addEventListener("click", () => {
    const subject = subjectInput.value.trim();
    if (!subject) { setStatus("❌ Email topic missing"); return; }
    chrome.runtime.sendMessage({ action: "sendTestEmail", subject }, (res) => {
      if (!res || chrome.runtime.lastError) setStatus("❌ Background error");
      else setStatus(res.status === "ok" ? "✅ Test email sent" : "❌ " + (res.message || "Error"));
    });
  });

  // SEND BULK EMAILS
  sendBtn.addEventListener("click", () => {
    if (sendBtn.disabled) return;
    const subject = subjectInput.value.trim();
    chrome.storage.local.set({ emailSubject: subject });
    setStatus("🚀 Sending emails...");
    chrome.runtime.sendMessage({ action: "sendBulkEmails", subject }, (res) => {
      if (!res || chrome.runtime.lastError) setStatus("❌ Background error");
      else setStatus(res.status === "ok" ? "✅ Emails sent" : "❌ " + (res.message || "Error"));
    });
  });
});
