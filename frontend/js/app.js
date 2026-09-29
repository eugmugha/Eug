// ---- Shared helpers ----
const API = "";

async function postJSON(url, body) {
  const res = await fetch(API + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Erreur");
  return data;
}

async function getJSON(url, token) {
  const res = await fetch(API + url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + (type || "");
}

// ---- Register ----
const regForm = document.getElementById("register-form");
if (regForm) {
  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(regForm);
    const payload = Object.fromEntries(fd.entries());
    try {
      await postJSON("/api/register", payload);
      showMsg("form-msg", "Compte créé avec succès ! Redirection…", "success");
      setTimeout(() => (window.location.href = "/login.html"), 1200);
    } catch (err) {
      showMsg("form-msg", err.message, "error");
    }
  });
}

// ---- Login ----
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const payload = Object.fromEntries(fd.entries());
    try {
      const data = await postJSON("/api/login", payload);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user_type", data.user_type);
      showMsg("form-msg", "Connexion réussie !", "success");
      if (data.is_admin) {
        setTimeout(() => (window.location.href = "/admin.html"), 800);
      } else {
        setTimeout(() => (window.location.href = "/"), 800);
      }
    } catch (err) {
      showMsg("form-msg", err.message, "error");
    }
  });
}

// ---- Admin ----
const adminLoginForm = document.getElementById("admin-login-form");
if (adminLoginForm) {
  // Auto-redirect if already logged in as admin
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const stats = await getJSON("/api/admin/stats", token);
      if (stats) showAdminDashboard(token);
    } catch {
      localStorage.removeItem("token");
    }
  }

  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(adminLoginForm);
    const payload = Object.fromEntries(fd.entries());
    try {
      const data = await postJSON("/api/login", payload);
      if (!data.is_admin) {
        showMsg("admin-msg", "Ce compte n'est pas administrateur", "error");
        return;
      }
      localStorage.setItem("token", data.access_token);
      showAdminDashboard(data.access_token);
    } catch (err) {
      showMsg("admin-msg", err.message, "error");
    }
  });
}

async function showAdminDashboard(token) {
  document.getElementById("admin-login-view").style.display = "none";
  document.getElementById("admin-dashboard").style.display = "block";
  document.getElementById("logout-btn").style.display = "block";

  try {
    const [stats, users] = await Promise.all([
      getJSON("/api/admin/stats", token),
      getJSON("/api/admin/users", token),
    ]);

    document.getElementById("stat-total").textContent = stats.total_users;
    document.getElementById("stat-sellers").textContent = stats.sellers;
    document.getElementById("stat-buyers").textContent = stats.buyers;

    const list = document.getElementById("users-list");
    if (users.length === 0) {
      list.innerHTML = '<p class="loading">Aucun utilisateur enregistré.</p>';
      return;
    }
    list.innerHTML = users
      .map((u) => {
        const date = new Date(u.created_at).toLocaleDateString("fr-FR");
        const initials = u.full_name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        return `
        <div class="user-card">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${esc(u.full_name)}</div>
            <div class="user-detail">📧 ${esc(u.email)}</div>
            <div class="user-detail">📞 ${esc(u.phone)}</div>
            <div class="user-detail">🏪 ${esc(u.business_name)}</div>
            <div class="user-detail">📍 ${esc(u.address)}</div>
            <div class="user-detail">Inscrit le ${date}</div>
            <span class="badge ${u.user_type}">${u.user_type === "seller" ? "Vendeur" : "Acheteur"}</span>
          </div>
        </div>`;
      })
      .join("");
  } catch (err) {
    document.getElementById("users-list").innerHTML =
      '<p class="loading">Erreur de chargement.</p>';
  }
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_type");
    window.location.reload();
  });
}

// ---- Service worker (PWA) ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
