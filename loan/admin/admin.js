const API_BASE = "https://owata-credit.itoutubasa1265.chatgpt.site";
const SESSION_KEY = "owata_credit_admin_session";

const state = {
  csrfToken: "",
  sessionToken: localStorage.getItem(SESSION_KEY) ?? "",
  loans: [],
  selectedLoan: null,
  selectedAction: null,
};
const $ = (selector) => document.querySelector(selector);

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("ja-JP");
}

function formatDate(value) {
  if (!value) return "未確定";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status) {
  return {
    pending_disbursement: "送金待ち",
    dispatching: "送金処理中",
    active: "返済期間中",
    overdue: "地下労働対象",
    repayment_pending: "返済確認中",
    reconciliation_required: "要確認",
    paid: "返済完了",
  }[status] ?? status;
}

function createSyncState(loan) {
  const sync = loan.minecraftSync ?? { state: "attention", payout: {}, repayment: {} };
  const labels = {
    waiting: ["Minecraft送金待ち", "waiting"],
    payout_waiting: ["送金応答待ち", "waiting"],
    payout_confirmed: ["入金同期済み", "confirmed"],
    repayment_waiting: ["返済応答待ち", "waiting"],
    paid_confirmed: ["完済同期済み", "confirmed"],
    attention: ["同期要確認", "attention"],
  };
  const [label, badgeClass] = labels[sync.state] ?? labels.attention;
  const container = document.createElement("div");
  container.className = "sync-state";
  const badge = document.createElement("span");
  badge.className = `sync-badge ${badgeClass}`;
  badge.textContent = label;
  container.append(badge);

  const operation =
    sync.state === "paid_confirmed" || sync.state === "repayment_waiting"
      ? sync.repayment
      : sync.payout;
  const detail = document.createElement("small");
  const operationId = operation?.operationId;
  if (operation?.confirmed) {
    detail.textContent =
      `${formatDate(operation.confirmedAt)} / ` +
      `${formatNumber(operation.balanceBefore)} → ${formatNumber(operation.balanceAfter)} owata`;
  } else if (operationId) {
    detail.textContent = `処理ID ${operationId.slice(0, 8)}… / ${formatDate(operation.operationUpdatedAt)}`;
  } else if (sync.state === "waiting") {
    detail.textContent = "Minecraftへの処理はまだ開始されていません";
  } else {
    detail.textContent = "成功応答・処理ID・残高記録を確認してください";
  }
  if (operationId) detail.title = `処理ID: ${operationId}`;
  container.append(detail);
  return container;
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
  if (!response.ok) {
    const error = new Error(data.error ?? "処理に失敗しました。");
    error.status = response.status;
    throw error;
  }
  return data;
}

function showMessage(message, success = false) {
  const box = $("#admin-message");
  box.textContent = message;
  box.classList.remove("hidden", "success");
  if (success) box.classList.add("success");
}

function createLoanActions(loan) {
  const container = document.createElement("div");
  container.className = "loan-actions";
  if (loan.status === "paid") {
    const complete = document.createElement("span");
    complete.className = "sync-badge confirmed";
    complete.textContent = "操作不要";
    container.append(complete);
    return container;
  }
  if (["dispatching", "repayment_pending"].includes(loan.status)) {
    const processing = document.createElement("span");
    processing.className = "sync-badge waiting";
    processing.textContent = "Minecraft処理中";
    container.append(processing);
    return container;
  }
  if (loan.currentAmount > 1) {
    const reduction = document.createElement("button");
    reduction.type = "button";
    reduction.className = "loan-action-button";
    reduction.textContent = "減額";
    reduction.addEventListener("click", () => openLoanAction("reduction", loan));
    container.append(reduction);
  }
  const deletion = document.createElement("button");
  deletion.type = "button";
  deletion.className = "loan-action-button delete";
  deletion.textContent = "削除";
  deletion.addEventListener("click", () => openLoanAction("deletion", loan));
  container.append(deletion);
  return container;
}

function openLoanAction(action, loan) {
  state.selectedAction = action;
  state.selectedLoan = loan;
  const dialog = $("#loan-action-dialog");
  const isDeletion = action === "deletion";
  dialog.classList.toggle("delete-mode", isDeletion);
  $("#loan-action-eyebrow").textContent = isDeletion ? "DELETE LOAN" : "REDUCE LOAN";
  $("#loan-action-title").textContent = isDeletion ? "借金を削除" : "借金を減額";
  $("#loan-action-gamertag").textContent = `${loan.gamertag} / ${loan.discordName}`;
  $("#loan-action-current").textContent = `${formatNumber(loan.currentAmount)} owata`;
  $("#reduction-fields").classList.toggle("hidden", isDeletion);
  $("#deletion-fields").classList.toggle("hidden", !isDeletion);
  $("#reduction-new-amount").required = !isDeletion;
  $("#deletion-confirm-gamertag").required = isDeletion;
  $("#reduction-new-amount").max = String(Math.max(1, loan.currentAmount - 1));
  $("#reduction-new-amount").value = "";
  $("#deletion-confirm-gamertag").value = "";
  $("#loan-action-reason").value = "";
  $("#loan-action-error").classList.add("hidden");
  $("#loan-action-submit").textContent = isDeletion ? "この借金を削除する" : "この金額へ減額する";
  dialog.showModal();
}

function closeLoanAction() {
  $("#loan-action-dialog").close();
  state.selectedAction = null;
  state.selectedLoan = null;
}

function renderTable() {
  const filter = $("#status-filter").value;
  const query = $("#loan-search").value.trim().toLocaleLowerCase("ja-JP");
  const rows = state.loans.filter((loan) => {
    const filterMatch =
      filter === "all" ||
      (filter === "open" && !["paid"].includes(loan.status)) ||
      (filter === "overdue" && loan.undergroundLaborRequired) ||
      loan.status === filter;
    const searchMatch =
      !query ||
      loan.gamertag.toLocaleLowerCase("ja-JP").includes(query) ||
      loan.discordName.toLocaleLowerCase("ja-JP").includes(query);
    return filterMatch && searchMatch;
  });

  const tbody = $("#loan-table-body");
  tbody.replaceChildren(...rows.map((loan) => {
    const tr = document.createElement("tr");
    if (loan.undergroundLaborRequired) tr.classList.add("underground-row");
    const status = document.createElement("span");
    status.className = `table-status ${loan.status}`;
    status.textContent = statusLabel(loan.status);
    const values = [
      status,
      loan.gamertag,
      loan.discordName,
      formatNumber(loan.principal),
      formatNumber(loan.currentAmount),
      createSyncState(loan),
      formatDate(loan.dueAt),
      loan.undergroundLaborRequired
        ? `${loan.overdueDays}日超過`
        : loan.daysRemaining === null
          ? "未送金"
          : `${loan.daysRemaining}日`,
      createLoanActions(loan),
    ];
    values.forEach((value, index) => {
      const td = document.createElement("td");
      if (value instanceof Node) td.append(value);
      else td.textContent = value;
      if (index === 3 || index === 4) td.classList.add("amount-cell");
      tr.append(td);
    });
    return tr;
  }));
  $("#empty-table-message").classList.toggle("hidden", rows.length > 0);
}

async function loadDashboard() {
  try {
    const data = await api("/api/admin/loans");
    state.csrfToken = data.csrfToken;
    state.loans = data.loans;
    $("#admin-login-card").classList.add("hidden");
    $("#admin-dashboard").classList.remove("hidden");
    $("#summary-open").textContent = formatNumber(data.totals.open);
    $("#summary-overdue").textContent = formatNumber(data.totals.overdue);
    $("#summary-amount").textContent = formatNumber(data.totals.currentAmount);
    $("#summary-all").textContent = formatNumber(data.totals.all);
    $("#summary-minecraft-confirmed").textContent =
      formatNumber(data.totals.minecraftConfirmed);
    $("#summary-sync-attention").textContent = formatNumber(data.totals.syncAttention);
    $("#admin-updated-at").textContent = `${formatDate(data.generatedAt)} 更新`;
    renderTable();
  } catch (error) {
    if (error.status === 401) {
      state.sessionToken = "";
      localStorage.removeItem(SESSION_KEY);
      $("#admin-login-card").classList.remove("hidden");
      $("#admin-dashboard").classList.add("hidden");
      return;
    }
    showMessage(error.message);
  }
}

$("#admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const message = $("#admin-login-message");
  message.classList.add("hidden");
  button.disabled = true;
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: { password: form.elements.password.value },
    });
    state.sessionToken = data.sessionToken;
    localStorage.setItem(SESSION_KEY, state.sessionToken);
    state.csrfToken = data.csrfToken;
    await loadDashboard();
  } catch (error) {
    message.textContent = error.message;
    message.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
});

$("#refresh-button").addEventListener("click", loadDashboard);
$("#backup-button").addEventListener("click", async () => {
  const button = $("#backup-button");
  button.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/admin/export`, {
      headers: { Authorization: `Session ${state.sessionToken}` },
    });
    if (!response.ok) throw new Error("JSON保存に失敗しました。");
    const blob = await response.blob();
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `owata-loans-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    showMessage("借金一覧と同期ログをJSONで保存しました。", true);
  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
  }
});
$("#logout-button").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST", body: {} });
  } catch {
    // The local session is cleared even if the network is temporarily unavailable.
  }
  state.sessionToken = "";
  state.csrfToken = "";
  state.loans = [];
  localStorage.removeItem(SESSION_KEY);
  $("#admin-dashboard").classList.add("hidden");
  $("#admin-login-card").classList.remove("hidden");
});
$("#status-filter").addEventListener("change", renderTable);
$("#loan-search").addEventListener("input", renderTable);
$("#loan-action-close").addEventListener("click", closeLoanAction);
$("#loan-action-cancel").addEventListener("click", closeLoanAction);
$("#loan-action-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeLoanAction();
});
$("#loan-action-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const loan = state.selectedLoan;
  const action = state.selectedAction;
  if (!loan || !action) return;
  const submit = $("#loan-action-submit");
  const errorBox = $("#loan-action-error");
  submit.disabled = true;
  errorBox.classList.add("hidden");
  try {
    const reason = $("#loan-action-reason").value.trim();
    const data = action === "reduction"
      ? await api(`/api/admin/loans/${loan.id}/reduction`, {
          method: "PATCH",
          body: {
            newAmount: Number($("#reduction-new-amount").value),
            reason,
          },
        })
      : await api(`/api/admin/loans/${loan.id}`, {
          method: "DELETE",
          body: {
            confirmGamertag: $("#deletion-confirm-gamertag").value,
            reason,
          },
        });
    closeLoanAction();
    showMessage(data.message, true);
    await loadDashboard();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.remove("hidden");
  } finally {
    submit.disabled = false;
  }
});

loadDashboard();
setInterval(loadDashboard, 30_000);
