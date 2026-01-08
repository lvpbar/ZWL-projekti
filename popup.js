// popup.js — disable inactive buttons until connected

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const status = $("statusMessage");
  const authBtn = $("googleAuthBtn");
  const sendBtn = $("sendEmailsBtn");
  const editCsvBtn = $("editCsvBtn");
  const editTemplateBtn = $("editTemplateBtn");

  const CSV_FILE_ID = "1lhDs6sZ_GkIYBnAh_LiuJC0GT7EV6TUn";
  const HTML_FILE_ID = "1w6etq94bceqxsL99Ji_rB1jtFVhYIVqS";

  // ---------- helpers ----------
  const setStatus = (msg) => {
    if (status) status.textContent = msg;
  };

  const setButtonsEnabled = (enabled) => {
    [sendBtn, editCsvBtn, editTemplateBtn].forEach((btn) => {
      if (!btn) return;
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? "1" : "0.5";
      btn.style.cursor = enabled ? "pointer" : "not-allowed";
    });
  };

  const openDriveFile = (id) => {
    try {
      chrome.tabs.create({
        url: `https://drive.google.com/open?id=${id}`,
      });
    } catch {
      setStatus("❌ Failed to open Google Drive");
    }
  };

  // ---------- INITIAL STATE ----------
  setButtonsEnabled(false);
  setStatus("Not connected");

  // ---------- Edit buttons ----------
  editCsvBtn?.addEventListener("click", () => {
    openDriveFile(CSV_FILE_ID);
  });

  editTemplateBtn?.addEventListener("click", () => {
    openDriveFile(HTML_FILE_ID);
  });

  // ---------- Connect / Switch account ----------
  authBtn?.addEventListener("click", () => {
    if (!chrome?.identity) {
      setStatus("❌ Google auth unavailable");
      return;
    }

    setStatus("🔐 Connecting...");

    // Try to remove cached token to allow account switching
    chrome.identity.getAuthToken({ interactive: false }, (oldToken) => {
      if (oldToken) {
        chrome.identity.removeCachedAuthToken({ token: oldToken }, () => {
          requestAuth();
        });
      } else {
        requestAuth();
      }
    });
  });

  function requestAuth() {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        setStatus("❌ Connection cancelled");
        setButtonsEnabled(false);
        return;
      }

      fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: "Bearer " + token },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((u) => {
          setButtonsEnabled(true);
          setStatus(
            u?.email
              ? `Connected as ${u.email}`
              : "Connected"
          );
        })
        .catch(() => {
          setButtonsEnabled(true);
          setStatus("Connected");
        });
    });
  }

  // ---------- Send emails ----------
  sendBtn?.addEventListener("click", () => {
    if (sendBtn.disabled) return;

    setStatus("🚀 Sending emails...");
    chrome.runtime.sendMessage({ action: "sendBulkEmails" }, (res) => {
      if (chrome.runtime.lastError || !res) {
        setStatus("❌ Background not ready");
        return;
      }
      setStatus(
        res.status === "ok"
          ? "✅ Emails sent successfully"
          : "❌ " + (res.message || "Error")
      );
    });
  });
});
