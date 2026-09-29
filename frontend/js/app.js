// ---- Shared helpers ----
const API = "";

async function postJSON(url, body, token) {
  const res = await fetch(API + url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function fmtPrice(n) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FC";
}

function getToken() {
  return localStorage.getItem("token");
}

function getUserType() {
  return localStorage.getItem("user_type");
}

// ---- Auth guard for buyer/seller pages ----
function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

// ---- Cart (localStorage) ----
function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(product) {
  const cart = getCart();
  const existing = cart.find((c) => c.product_id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      emoji: product.image_emoji || "📦",
      seller_name: product.seller_name,
      quantity: 1,
    });
  }
  saveCart(cart);
}

function removeFromCart(productId) {
  const cart = getCart().filter((c) => c.product_id !== productId);
  saveCart(cart);
}

function updateQty(productId, delta) {
  const cart = getCart();
  const item = cart.find((c) => c.product_id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    saveCart(cart);
  }
}

function clearCart() {
  localStorage.removeItem("cart");
  updateCartBadge();
}

function cartTotal() {
  return getCart().reduce((sum, c) => sum + c.price * c.quantity, 0);
}

function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  if (!badge) return;
  const count = getCart().reduce((n, c) => n + c.quantity, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? "" : "none";
}

// ---- Logout (works on all pages) ----
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_type");
    localStorage.removeItem("cart");
    window.location.href = "/login.html";
  });
}

// ---- Register ----
const regForm = document.getElementById("register-form");
if (regForm) {
  const typeSelect = document.getElementById("user_type");
  const sellerFields = document.getElementById("seller-fields");
  const buyerFields = document.getElementById("buyer-fields");

  typeSelect.addEventListener("change", () => {
    const v = typeSelect.value;
    sellerFields.style.display = v === "seller" ? "block" : "none";
    buyerFields.style.display = v === "buyer" ? "block" : "none";
  });

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
        setTimeout(() => (window.location.href = "/marketplace.html"), 800);
      }
    } catch (err) {
      showMsg("form-msg", err.message, "error");
    }
  });
}

// ---- Admin ----
(async () => {
  const adminLoginForm = document.getElementById("admin-login-form");
  if (!adminLoginForm) return;
  const token = getToken();
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
})();

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
        let profileHtml = "";
        if (u.seller_profile) {
          const sp = u.seller_profile;
          profileHtml = `
            ${sp.category ? `<div class="user-detail">🏷️ Catégorie : ${esc(sp.category)}</div>` : ""}
            ${sp.business_description ? `<div class="user-detail">📝 ${esc(sp.business_description)}</div>` : ""}`;
        } else if (u.buyer_profile) {
          const bp = u.buyer_profile;
          profileHtml = `
            ${bp.delivery_address ? `<div class="user-detail">📦 Livraison : ${esc(bp.delivery_address)}</div>` : ""}`;
        }
        const profileCity = u.seller_profile?.city || u.buyer_profile?.city;
        return `
        <div class="user-card">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${esc(u.full_name)}</div>
            <div class="user-detail">📧 ${esc(u.email)}</div>
            <div class="user-detail">📞 ${esc(u.phone)}</div>
            <div class="user-detail">🏪 ${esc(u.business_name)}</div>
            <div class="user-detail">📍 ${esc(u.address)}${profileCity ? " — " + esc(profileCity) : ""}</div>
            ${profileHtml}
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

// ---- Marketplace ----
const productsGrid = document.getElementById("products-grid");
if (productsGrid) {
  if (!requireAuth()) throw new Error("redirect");

  // Show seller panel
  if (getUserType() === "seller") {
    document.getElementById("seller-panel").style.display = "block";
  }
  updateCartBadge();

  async function loadProducts() {
    try {
      const products = await getJSON("/api/products");
      if (products.length === 0) {
        productsGrid.innerHTML = '<p class="loading">Aucun produit disponible pour le moment.</p>';
        return;
      }
      productsGrid.innerHTML = products
        .map(
          (p) => `
        <div class="product-card">
          <div class="product-emoji">${esc(p.image_emoji) || "📦"}</div>
          <div class="product-info">
            <div class="product-name">${esc(p.name)}</div>
            <div class="product-seller">🏪 ${esc(p.seller_name)}</div>
            ${p.category ? `<span class="badge seller">${esc(p.category)}</span>` : ""}
            <div class="product-price">${fmtPrice(p.price)}</div>
            <div class="product-stock">${p.stock > 0 ? `${p.stock} en stock` : "Rupture de stock"}</div>
            <button class="btn-add-cart" data-id="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>
              ${p.stock > 0 ? "🛒 Ajouter" : "Indisponible"}
            </button>
          </div>
        </div>`
        )
        .join("");

      // Wire add-to-cart buttons
      productsGrid.querySelectorAll(".btn-add-cart").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = parseInt(btn.dataset.id);
          const product = products.find((p) => p.id === id);
          if (!product) return;
          addToCart(product);
          btn.textContent = "✅ Ajouté !";
          setTimeout(() => {
            btn.textContent = "🛒 Ajouter";
          }, 1000);
        });
      });
    } catch (err) {
      productsGrid.innerHTML = '<p class="loading">Erreur de chargement des produits.</p>';
    }
  }

  loadProducts();

  // Seller product form
  const productForm = document.getElementById("product-form");
  if (productForm) {
    productForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(productForm);
      const payload = Object.fromEntries(fd.entries());
      payload.price = parseFloat(payload.price);
      payload.stock = parseInt(payload.stock) || 0;
      const token = getToken();
      try {
        await postJSON("/api/products", payload, token);
        showMsg("product-msg", "Produit publié !", "success");
        productForm.reset();
        loadProducts();
      } catch (err) {
        showMsg("product-msg", err.message, "error");
      }
    });
  }
}

// ---- Cart page ----
const cartItemsEl = document.getElementById("cart-items");
if (cartItemsEl) {
  if (!requireAuth()) throw new Error("redirect");
  updateCartBadge();
  renderCart();

  function renderCart() {
    const cart = getCart();
    const summary = document.getElementById("cart-summary");
    const empty = document.getElementById("cart-empty");

    if (cart.length === 0) {
      cartItemsEl.innerHTML = "";
      summary.style.display = "none";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    summary.style.display = "block";

    cartItemsEl.innerHTML = cart
      .map(
        (c) => `
      <div class="cart-item">
        <div class="cart-item-emoji">${esc(c.emoji) || "📦"}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${esc(c.name)}</div>
          <div class="cart-item-seller">🏪 ${esc(c.seller_name)}</div>
          <div class="cart-item-price">${fmtPrice(c.price)}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" data-id="${c.product_id}" data-delta="-1">−</button>
            <span class="qty-value">${c.quantity}</span>
            <button class="qty-btn" data-id="${c.product_id}" data-delta="1">+</button>
            <button class="qty-remove" data-id="${c.product_id}">🗑️</button>
          </div>
          <div class="cart-item-subtotal">Sous-total: ${fmtPrice(c.price * c.quantity)}</div>
        </div>
      </div>`
      )
      .join("");

    document.getElementById("cart-total-amount").textContent = fmtPrice(cartTotal());

    // Wire quantity buttons
    cartItemsEl.querySelectorAll(".qty-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        updateQty(parseInt(btn.dataset.id), parseInt(btn.dataset.delta));
        renderCart();
      });
    });
    cartItemsEl.querySelectorAll(".qty-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeFromCart(parseInt(btn.dataset.id));
        renderCart();
      });
    });
  }

  // Checkout
  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", async () => {
      const cart = getCart();
      if (cart.length === 0) return;
      const deliveryAddress = document.getElementById("delivery-address").value.trim();
      const token = getToken();
      try {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = "Validation…";
        await postJSON(
          "/api/orders",
          {
            items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
            delivery_address: deliveryAddress || null,
          },
          token
        );
        clearCart();
        showMsg("checkout-msg", "Commande validée ! Redirection…", "success");
        setTimeout(() => (window.location.href = "/orders.html"), 1000);
      } catch (err) {
        showMsg("checkout-msg", err.message, "error");
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "Valider la commande";
      }
    });
  }
}

// ---- Orders page ----
(async () => {
  const ordersListEl = document.getElementById("orders-list");
  if (!ordersListEl) return;
  if (!requireAuth()) return;
  updateCartBadge();

  const token = getToken();
  try {
    const orders = await getJSON("/api/orders", token);
    if (orders.length === 0) {
      ordersListEl.innerHTML =
        '<p class="loading">Aucune commande pour le moment.</p>';
      return;
    }
    ordersListEl.innerHTML = orders
      .map((o) => {
        const date = new Date(o.created_at).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const itemsHtml = o.items
          .map(
            (it) =>
              `<div class="order-item-line">${esc(it.product_name)} × ${it.quantity} — ${fmtPrice(it.unit_price * it.quantity)}</div>`
          )
          .join("");
        const statusLabel = { confirmed: "Confirmée", delivered: "Livrée", cancelled: "Annulée" }[o.status] || o.status;
        return `
        <div class="order-card">
          <div class="order-header">
            <span class="order-id">Commande #${o.id}</span>
            <span class="order-status ${o.status}">${statusLabel}</span>
          </div>
          <div class="order-date">${date}</div>
          ${o.delivery_address ? `<div class="order-address">📍 ${esc(o.delivery_address)}</div>` : ""}
          <div class="order-items">${itemsHtml}</div>
          <div class="order-total">Total: ${fmtPrice(o.total)}</div>
        </div>`;
      })
      .join("");
  } catch (err) {
    ordersListEl.innerHTML = '<p class="loading">Erreur de chargement.</p>';
  }
})();

// ---- Index page: dynamic nav for logged-in users ----
const indexNav = document.getElementById("index-dynamic-nav");
if (indexNav) {
  const token = getToken();
  if (token) {
    const userType = getUserType();
    indexNav.innerHTML = `
      <a href="/marketplace.html" class="action-card primary">
        <span class="action-icon">🏪</span>
        <span class="action-title">Boutique</span>
        <span class="action-desc">Parcourir les produits</span>
      </a>
      <a href="/cart.html" class="action-card">
        <span class="action-icon">🛒</span>
        <span class="action-title">Mon Panier</span>
        <span class="action-desc">Voir et valider ma commande</span>
      </a>
      <a href="/orders.html" class="action-card">
        <span class="action-icon">📦</span>
        <span class="action-title">Mes Commandes</span>
        <span class="action-desc">Suivre mes commandes</span>
      </a>
      <button id="index-logout" class="btn-primary" style="margin-top:8px;background:var(--danger)">Déconnexion</button>`;
    document.getElementById("index-logout").addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user_type");
      localStorage.removeItem("cart");
      window.location.reload();
    });
    const defaultNav = document.getElementById("index-default-nav");
    if (defaultNav) defaultNav.style.display = "none";
  }
}

// ---- Service worker (PWA) ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
