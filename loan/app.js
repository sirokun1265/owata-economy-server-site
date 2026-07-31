const API_BASE = "https://owata-credit.itoutubasa1265.chatgpt.site";
const SESSION_KEY = "owata_credit_user_session";

const state = {
  csrfToken: "",
  sessionToken: localStorage.getItem(SESSION_KEY) ?? "",
  account: null,
  loan: null,
  terms: {
    minimumLoanAmount: 1,
    maximumLoanAmount: 10000000,
    interestPercentPerDay: 5,
    interestAccrualDays: 20,
    dueDays: 20,
  },
};

const $ = (selector) => document.querySelector(selector);
const guestView = $("#guest-view");
const accountView = $("#account-view");
const registerForm = $("#register-form");
const loginForm = $("#login-form");
const loanForm = $("#loan-form");
const termsCheckbox = $("#accepted-terms");
const loanSubmitButton = $("#loan-submit-button");
const messageBox = $("#message-box");

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("ja-JP");
}

function formatDate(value) {
  if (!value) return "未送金";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function showMessage(message, success = false) {
  messageBox.textContent = message;
  messageBox.classList.remove("hidden", "success");
  if (success) messageBox.classList.add("success");
}

function clearMessage() {
  messageBox.classList.add("hidden");
  messageBox.textContent = "";
}

async function api(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (state.sessionToken) {
    headers.Authorization = `Session ${state.sessionToken}`;
  }
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (state.csrfToken && options.method && options.method !== "GET") {
    headers["X-CSRF-Token"] = state.csrfToken;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "処理に失敗しました。");
  return data;
}

function setTab(tab) {
  const registerActive = tab === "register";
  $("#register-tab").classList.toggle("active", registerActive);
  $("#login-tab").classList.toggle("active", !registerActive);
  $("#register-tab").setAttribute("aria-selected", String(registerActive));
  $("#login-tab").setAttribute("aria-selected", String(!registerActive));
  registerForm.classList.toggle("hidden", !registerActive);
  loginForm.classList.toggle("hidden", registerActive);
  clearMessage();
}

function statusLabel(status) {
  return {
    pending_disbursement: "Minecraft送金待ち",
    dispatching: "送金処理中",
    active: "返済期間中",
    overdue: "期限超過・地下労働対象",
    repayment_pending: "返済処理中",
    reconciliation_required: "運営確認中",
  }[status] ?? status;
}

function render() {
  const authenticated = Boolean(state.account);
  guestView.classList.toggle("hidden", authenticated);
  accountView.classList.toggle("hidden", !authenticated);
  if (!authenticated) return;

  $("#account-gamertag").textContent = state.account.gamertag;
  $("#account-discord").textContent = `Discord: ${state.account.discordName}`;
  const application = $("#loan-application");
  const loanStatus = $("#loan-status");
  const loanReceipt = $("#loan-receipt");
  application.classList.toggle("hidden", Boolean(state.loan));
  loanStatus.classList.toggle("hidden", !state.loan);
  loanReceipt.classList.toggle("hidden", !state.loan);
  if (!state.loan) return;

  const loan = state.loan;
  const badge = $("#loan-status-badge");
  badge.textContent = statusLabel(loan.status);
  badge.classList.toggle("overdue", loan.undergroundLaborRequired);
  $("#loan-current-amount").textContent = loan.currentAmountText;
  $("#loan-principal").textContent = loan.principalText;
  $("#loan-start").textContent = formatDate(loan.disbursedAt);
  $("#loan-due").textContent = formatDate(loan.dueAt);
  $("#receipt-requested").textContent = formatDate(loan.requestedAt);
  $("#receipt-reflected").textContent = loan.disbursedAt
    ? formatDate(loan.disbursedAt)
    : "Minecraft反映待ち";
  $("#receipt-due").textContent = loan.dueAt
    ? `${formatDate(loan.dueAt)}まで`
    : `Minecraft反映後に確定（反映日から${state.terms.dueDays}日後）`;
  $("#receipt-rate").textContent =
    `1日${state.terms.interestPercentPerDay}%（単利）`;
  const maximumAtDue = Math.ceil(
    loan.principal
      * (1 + (state.terms.interestPercentPerDay / 100) * state.terms.interestAccrualDays),
  );
  $("#receipt-maximum").textContent = `返済額 ${formatNumber(maximumAtDue)} owata`;
  $("#receipt-status").textContent = loan.disbursedAt
    ? "Minecraftへの入金反映を確認しました。"
    : "申請を受け付けました。Minecraftへログインすると入金処理が行われます。";

  if (loan.status === "pending_disbursement") {
    $("#loan-days").textContent = "ログイン待ち";
    $("#loan-guidance").textContent = "Minecraftへログインすると、本人のmoneyスコアへ借入額が送金されます。";
  } else if (loan.status === "dispatching") {
    $("#loan-days").textContent = "処理中";
    $("#loan-guidance").textContent = "Minecraftへの送金を確認しています。重複防止のため再申請はできません。";
  } else if (loan.undergroundLaborRequired) {
    $("#loan-days").textContent = `${loan.overdueDays}日超過`;
    $("#loan-guidance").textContent = "返済期限を超えています。返済ブロックから完済し、運営の案内に従ってください。";
  } else if (loan.status === "repayment_pending") {
    $("#loan-days").textContent = "返済確認中";
    $("#loan-guidance").textContent = "Minecraft側の返済結果を確認しています。";
  } else {
    $("#loan-days").textContent = `期限まで ${loan.daysRemaining}日`;
    $("#loan-guidance").textContent = "返済はMinecraft内の返済ブロックにボタンまたは感圧板で電力を加えて行います。";
  }
}

function updatePreview() {
  const amount = Math.max(0, Math.trunc(Number(loanForm.elements.amount.value) || 0));
  const factor = 1 + (state.terms.interestPercentPerDay / 100) * state.terms.interestAccrualDays;
  $("#loan-preview strong").textContent = `${formatNumber(Math.ceil(amount * factor))} owata`;
}

function updateTermsConsent() {
  const accepted = termsCheckbox.checked;
  loanSubmitButton.disabled = !accepted;
  loanSubmitButton.setAttribute("aria-disabled", String(!accepted));
  const help = $("#terms-consent-help");
  help.textContent = accepted
    ? "利用規約への同意を確認しました。申請できます。"
    : "チェックを入れるまで借金は申し込めません。";
  help.classList.toggle("ready", accepted);
}

async function loadSession() {
  try {
    const data = await api("/api/me");
    state.terms = data.terms ?? state.terms;
    state.csrfToken = data.csrfToken ?? "";
    state.account = data.authenticated ? data.account : null;
    state.loan = data.authenticated ? data.loan : null;
    loanForm.elements.amount.min = String(state.terms.minimumLoanAmount);
    loanForm.elements.amount.max = String(state.terms.maximumLoanAmount);
    $("#connection-status").textContent = "ONLINE";
    updatePreview();
    render();
  } catch (error) {
    $("#connection-status").textContent = "OFFLINE";
    showMessage(error.message);
  }
}

$("#register-tab").addEventListener("click", () => setTab("register"));
$("#login-tab").addEventListener("click", () => setTab("login"));

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const button = registerForm.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(registerForm));
    const data = await api("/api/register", { method: "POST", body: values });
    state.sessionToken = data.sessionToken;
    localStorage.setItem(SESSION_KEY, state.sessionToken);
    state.csrfToken = data.csrfToken;
    state.account = data.account;
    state.loan = data.loan;
    state.terms = data.terms;
    render();
    showMessage("登録が完了しました。続けて借入額を入力してください。", true);
  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const button = loginForm.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(loginForm));
    const data = await api("/api/login", { method: "POST", body: values });
    state.sessionToken = data.sessionToken;
    localStorage.setItem(SESSION_KEY, state.sessionToken);
    state.csrfToken = data.csrfToken;
    state.account = data.account;
    state.loan = data.loan;
    state.terms = data.terms;
    render();
    showMessage("ログインしました。", true);
  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
  }
});

loanForm.elements.amount.addEventListener("input", updatePreview);
termsCheckbox.addEventListener("change", updateTermsConsent);
loanForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const amount = Math.trunc(Number(loanForm.elements.amount.value));
  const acceptedTerms = loanForm.elements.acceptedTerms.checked;
  if (!acceptedTerms) {
    updateTermsConsent();
    showMessage("利用規約を確認し、同意のチェックを入れてください。");
    termsCheckbox.focus();
    return;
  }
  const maximumAtDue = Math.ceil(
    amount * (1 + (state.terms.interestPercentPerDay / 100) * state.terms.interestAccrualDays),
  );
  if (!window.confirm(
    `${formatNumber(amount)} owataを借ります。\n` +
    `20日目の返済額は${formatNumber(maximumAtDue)} owataです。\n` +
    "この内容で申請しますか？",
  )) return;

  const button = loanSubmitButton;
  button.disabled = true;
  try {
    const data = await api("/api/loans", {
      method: "POST",
      body: { amount, acceptedTerms },
    });
    state.account = data.account;
    state.loan = data.loan;
    render();
    showMessage("借金申請を受け付けました。Minecraftへログインすると送金されます。", true);
  } catch (error) {
    showMessage(error.message);
  } finally {
    updateTermsConsent();
  }
});

$("#logout-button").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST", body: {} });
  } finally {
    state.sessionToken = "";
    localStorage.removeItem(SESSION_KEY);
    state.csrfToken = "";
    state.account = null;
    state.loan = null;
    render();
    setTab("login");
  }
});

loadSession();
updateTermsConsent();
setInterval(() => {
  if (state.account && state.loan) loadSession();
}, 30_000);
