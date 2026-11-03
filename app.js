const DEFAULT_CONFIG = { annualDays: 30, hoursPerDay: 7.25 };
const STORAGE_KEY = "vacationConfig";
const LEAVES_KEY = "vacationLeaves";
const BALANCE_KEY = "vacationBalance";
const BALANCE_DATE_KEY = "vacationBalanceDate";
const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function monthlyAccrual(config) {
  return (config.annualDays * config.hoursPerDay) / 12;
}

// Nombre de derniers jours du mois dans ]today, target] (today exclu, target inclus).
function countMonthEnds(today, target) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  let count = 0;
  let year = start.getFullYear();
  let month = start.getMonth();
  for (;;) {
    const monthEnd = new Date(year, month + 1, 0);
    if (monthEnd > end) break;
    if (monthEnd > start) count++;
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return count;
}

function parseLocalDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Jours ouvrables (lun-ven) de [start, end] qui tombent aussi dans [from, to].
function countWeekdays(start, end, from, to) {
  const first = start > from ? start : from;
  const last = end < to ? end : to;
  let count = 0;
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

// Jours de congé planifiés entre today (inclus) et target (inclus).
function leaveDaysBetween(leaves, today, target) {
  return leaves.reduce(
    (sum, l) => sum + countWeekdays(parseLocalDate(l.start), parseLocalDate(l.end), today, target),
    0
  );
}

function leavesOverlap(a, b) {
  return a.start <= b.end && b.start <= a.end;
}

function projectBalance(currentHours, target, today, config, leaves = []) {
  const monthEnds = countMonthEnds(today, target);
  const accrual = monthlyAccrual(config);
  const leaveDays = leaveDaysBetween(leaves, today, target);
  const leaveHours = leaveDays * config.hoursPerDay;
  return { monthEnds, accrual, leaveDays, leaveHours, hours: currentHours + monthEnds * accrual - leaveHours };
}

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.annualDays > 0 && saved.hoursPerDay > 0) return saved;
  } catch (e) {}
  return { ...DEFAULT_CONFIG };
}

function loadLeaves() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEAVES_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return [];
}

if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toFixed(2);
  // 21.1 jours -> "4 semaines et 1.1 jour" (semaine = 5 jours)
  function fmtWeeks(days) {
    const total = Math.round(Math.abs(days) * 10) / 10;
    const weeks = Math.floor(total / 5);
    const rest = Math.round((total - weeks * 5) * 10) / 10;
    const parts = [];
    if (weeks > 0 || rest === 0) parts.push(`${weeks} semaine${weeks > 1 ? "s" : ""}`);
    if (rest > 0) parts.push(`${rest} jour${rest >= 2 ? "s" : ""}`);
    return (days < 0 && total > 0 ? "−" : "") + parts.join(" et ");
  }
  const fmtDate =(iso) => parseLocalDate(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  let config = loadConfig();
  let leaves = loadLeaves();
  let balanceDate = localStorage.getItem(BALANCE_DATE_KEY);
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let pendingStart = null;
  let editingId = null;

  function showView(name) {
    for (const view of ["calc", "leaves", "config"]) {
      $("view-" + view).hidden = view !== name;
      if (view !== "config") $("tab-" + view).classList.toggle("active", view === name);
    }
    $("open-config").classList.toggle("active", name === "config");
  }

  function renderAccrual() {
    const days = parseFloat($("annualDays").value);
    const hours = parseFloat($("hoursPerDay").value);
    $("accrual").textContent =
      days > 0 && hours > 0 ? fmt(monthlyAccrual({ annualDays: days, hoursPerDay: hours })) + " h" : "–";
  }

  function calculate() {
    const out = $("result");
    const estimated = $("estimated");
    const balance = parseFloat($("balance").value);
    const dateValue = $("targetDate").value;
    const t = new Date();
    const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    estimated.textContent = "";
    if (isNaN(balance)) {
      out.textContent = "Entre ton solde actuel et la date des vacances.";
      return;
    }
    // Le solde saisi date de balanceDate: on projette à partir de cette date.
    const base = parseLocalDate(balanceDate || toISO(today));
    if (base < today) {
      const now = projectBalance(balance, today, base, config, leaves);
      estimated.textContent = `Solde actuel estimé: ${fmt(now.hours)} h (calculé depuis ${fmt(balance)} h saisies le ${fmtDate(toISO(base))}).`;
    }
    if (!dateValue) {
      out.textContent = "Entre ton solde actuel et la date des vacances.";
      return;
    }
    const target = parseLocalDate(dateValue);
    if (target < today) {
      out.textContent = "La date doit être aujourd'hui ou plus tard.";
      return;
    }
    const r = projectBalance(balance, target, base, config, leaves);
    const warning = r.hours < 0 ? `<br><small class="negative">Attention: solde négatif à cette date.</small>` : "";
    out.innerHTML =
      `<strong class="${r.hours < 0 ? "negative" : ""}">${fmt(r.hours)} h</strong> (≈ ${fmt(r.hours / config.hoursPerDay)} jours, soit ${fmtWeeks(r.hours / config.hoursPerDay)})` +
      `<br><small>+ ${fmt(r.monthEnds * r.accrual)} h accumulées (${r.monthEnds} fin(s) de mois × ${fmt(r.accrual)} h)` +
      `<br>− ${fmt(r.leaveHours)} h de congés planifiés (${r.leaveDays} jour(s))</small>` +
      warning;
  }

  function saveLeaves() {
    leaves.sort((a, b) => a.start.localeCompare(b.start));
    localStorage.setItem(LEAVES_KEY, JSON.stringify(leaves));
    renderLeaves();
    calculate();
  }

  function setLeavesMessage(text) {
    $("leaves-message").textContent = text;
  }

  // Valide une plage; renvoie un message d'erreur ou null.
  function validateLeave(start, end, ignoreId) {
    if (!start || !end) return "Entre une date de début et de fin.";
    if (start > end) return "La date de fin doit être après la date de début.";
    if (countWeekdays(parseLocalDate(start), parseLocalDate(end), parseLocalDate(start), parseLocalDate(end)) === 0) {
      return "Cette plage ne contient aucun jour ouvrable.";
    }
    if (leaves.some((l) => l.id !== ignoreId && leavesOverlap(l, { start, end }))) {
      return "Cette plage chevauche un congé déjà planifié.";
    }
    return null;
  }

  function leaveAt(iso) {
    return leaves.find((l) => l.start <= iso && iso <= l.end);
  }

  function renderCalendar() {
    $("month-label").textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
    const grid = $("calendar");
    grid.innerHTML = "";
    for (const name of ["D", "L", "M", "M", "J", "V", "S"]) {
      const h = document.createElement("div");
      h.className = "dow";
      h.textContent = name;
      grid.appendChild(h);
    }
    const offset = new Date(viewYear, viewMonth, 1).getDay();
    for (let i = 0; i < offset; i++) grid.appendChild(document.createElement("div"));
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayISO = toISO(new Date());
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toISO(new Date(viewYear, viewMonth, day));
      const dow = new Date(viewYear, viewMonth, day).getDay();
      const cell = document.createElement("button");
      cell.type = "button";
      cell.textContent = day;
      cell.className = "day";
      if (dow === 0 || dow === 6) cell.classList.add("weekend");
      if (iso === todayISO) cell.classList.add("today");
      const leave = leaveAt(iso);
      if (leave) cell.classList.add("leave");
      if (leave && leave.id === editingId) cell.classList.add("editing");
      if (iso === pendingStart) cell.classList.add("pending");
      cell.addEventListener("click", () => onDayClick(iso));
      grid.appendChild(cell);
    }
  }

  function onDayClick(iso) {
    const existing = leaveAt(iso);
    if (existing) {
      pendingStart = null;
      openEditor(existing.id);
      return;
    }
    closeEditor();
    if (!pendingStart) {
      pendingStart = iso;
      setLeavesMessage(`Début: ${fmtDate(iso)}. Clique sur la date de fin (ou le même jour pour un seul jour).`);
    } else {
      const start = pendingStart < iso ? pendingStart : iso;
      const end = pendingStart < iso ? iso : pendingStart;
      const error = validateLeave(start, end, null);
      pendingStart = null;
      if (error) {
        setLeavesMessage(error);
      } else {
        leaves.push({ id: Date.now().toString(36), start, end });
        setLeavesMessage("Congé ajouté.");
        saveLeaves();
        return;
      }
    }
    renderCalendar();
  }

  function openEditor(id) {
    const leave = leaves.find((l) => l.id === id);
    if (!leave) return;
    editingId = id;
    $("editStart").value = leave.start;
    $("editEnd").value = leave.end;
    $("editor").hidden = false;
    setLeavesMessage("");
    renderLeaves();
  }

  function closeEditor() {
    editingId = null;
    $("editor").hidden = true;
    renderLeaves();
  }

  function deleteLeave(id) {
    leaves = leaves.filter((l) => l.id !== id);
    if (editingId === id) {
      editingId = null;
      $("editor").hidden = true;
    }
    setLeavesMessage("Congé supprimé.");
    saveLeaves();
  }

  function renderLeaves() {
    renderCalendar();
    const list = $("leaves-list");
    list.innerHTML = "";
    if (leaves.length === 0) {
      list.innerHTML = `<li class="empty">Aucun congé planifié.</li>`;
      return;
    }
    for (const l of leaves) {
      const days = countWeekdays(parseLocalDate(l.start), parseLocalDate(l.end), parseLocalDate(l.start), parseLocalDate(l.end));
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${fmtDate(l.start)} → ${fmtDate(l.end)} · ${days} jour(s) · ${fmt(days * config.hoursPerDay)} h`;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Modifier";
      edit.addEventListener("click", () => openEditor(l.id));
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Supprimer";
      del.addEventListener("click", () => deleteLeave(l.id));
      li.append(label, edit, del);
      list.appendChild(li);
    }
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    } else if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    renderCalendar();
  }

  $("tab-calc").addEventListener("click", () => showView("calc"));
  $("tab-leaves").addEventListener("click", () => showView("leaves"));
  $("open-config").addEventListener("click", () => showView($("view-config").hidden ? "config" : "calc"));
  $("calc-form").addEventListener("input", () => {
    const balance = $("balance").value;
    if (balance === "") {
      balanceDate = null;
      localStorage.removeItem(BALANCE_KEY);
      localStorage.removeItem(BALANCE_DATE_KEY);
    } else {
      balanceDate = toISO(new Date());
      localStorage.setItem(BALANCE_KEY, balance);
      localStorage.setItem(BALANCE_DATE_KEY, balanceDate);
    }
    calculate();
  });
  $("config-form").addEventListener("input", renderAccrual);
  $("config-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const annualDays = parseFloat($("annualDays").value);
    const hoursPerDay = parseFloat($("hoursPerDay").value);
    if (!(annualDays > 0 && hoursPerDay > 0)) return;
    config = { annualDays, hoursPerDay };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    $("saved").textContent = "Enregistré ✓";
    setTimeout(() => ($("saved").textContent = ""), 2000);
    renderLeaves();
    calculate();
  });

  $("prev-month").addEventListener("click", () => shiftMonth(-1));
  $("next-month").addEventListener("click", () => shiftMonth(1));
  $("edit-save").addEventListener("click", () => {
    const start = $("editStart").value;
    const end = $("editEnd").value;
    const error = validateLeave(start, end, editingId);
    if (error) {
      setLeavesMessage(error);
      return;
    }
    const leave = leaves.find((l) => l.id === editingId);
    leave.start = start;
    leave.end = end;
    setLeavesMessage("Congé modifié.");
    closeEditor();
    saveLeaves();
  });
  $("edit-delete").addEventListener("click", () => deleteLeave(editingId));
  $("edit-cancel").addEventListener("click", () => {
    setLeavesMessage("");
    closeEditor();
  });

  $("balance").value = localStorage.getItem(BALANCE_KEY) ?? "";
  if ($("balance").value !== "" && !balanceDate) {
    // Solde sauvegardé avant l'ajout de la date de saisie: on suppose aujourd'hui.
    balanceDate = toISO(new Date());
    localStorage.setItem(BALANCE_DATE_KEY, balanceDate);
  }
  $("annualDays").value = config.annualDays;
  $("hoursPerDay").value = config.hoursPerDay;
  renderAccrual();
  renderLeaves();
  calculate();
  showView("calc");
}

if (typeof module !== "undefined") {
  module.exports = { projectBalance, countMonthEnds, monthlyAccrual, countWeekdays, leaveDaysBetween, leavesOverlap };
}
