// ==========================================
// ESTADO GLOBAL DE LA APLICACIÓN (V3 CON GESTIÓN DE ROLES)
// ==========================================
let products = [];
let clients = [];
let cart = [];
let currentSaleDetails = [];
let currentUser = null; // { id_usuario, nombre, email, rol, id_cliente }

// Elementos del DOM
const menuGrid = document.getElementById("menuGrid");
const cartItems = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const cartCount = document.getElementById("cartCount");
const toast = document.getElementById("toast");
const clienteSelect = document.getElementById("clienteSelect");
const headerAuthZone = document.getElementById("headerAuthZone");
const authGateOverlay = document.getElementById("authGateOverlay");
const roleBanner = document.getElementById("roleBanner");

// Formato de moneda MXN
function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(value);
}

// Toast Notificación
function showToast(message, type = "normal") {
  toast.textContent = message;
  toast.className = "toast show";
  if (type === "success") toast.classList.add("success");
  if (type === "error") toast.classList.add("error");
  if (type === "special") toast.classList.add("special");
  if (type === "info") toast.classList.add("info");
  setTimeout(() => {
    toast.className = "toast";
  }, 3800);
}

// ==========================================
// 1. CONTROL DE ACCESO OBLIGATORIO (GATE OVERLAY)
// ==========================================
function cambiarAuthTab(paneId) {
  document.querySelectorAll(".auth-switch-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.pane === paneId);
  });
  document.querySelectorAll(".auth-pane").forEach(pane => {
    pane.classList.toggle("active", pane.id === paneId);
  });
}

function abrirAuthGate() {
  authGateOverlay.classList.remove("hidden");
}

function cerrarAuthGate() {
  authGateOverlay.classList.add("hidden");
}

// Login desde el Gate
async function ejecutarLoginGate(e) {
  e.preventDefault();
  const email = document.getElementById("gateLoginEmail").value.trim();
  const password = document.getElementById("gateLoginPassword").value.trim();

  await realizarLogin(email, password);
}

// Registro de Cliente desde el Gate
async function ejecutarRegistroGate(e) {
  e.preventDefault();
  const nombre = document.getElementById("gateRegNombre").value.trim();
  const email = document.getElementById("gateRegEmail").value.trim();
  const telefono = document.getElementById("gateRegTel").value.trim();
  const password = document.getElementById("gateRegPass").value.trim();

  try {
    const res = await fetch("api.php?action=registro_cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, telefono, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Error al registrarse");

    currentUser = data.usuario;
    cerrarAuthGate();
    aplicarRolEnInterfaz();
    showToast(data.mensaje, "success");
    await loadClientes();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Ingresar como Invitado
async function ejecutarInvitadoGate() {
  try {
    const res = await fetch("api.php?action=login_invitado");
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Error en modo invitado");

    currentUser = data.usuario;
    cerrarAuthGate();
    aplicarRolEnInterfaz();
    showToast(data.mensaje, "info");
    await loadClientes();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Demo rápido: Admin
async function demoLoginAdmin() {
  await realizarLogin("admin@cafeconleche.com", "admin123");
}

// Demo rápido: Cliente
async function demoLoginCliente() {
  await realizarLogin("valeria@example.com", "cliente123");
}

// Función común de login
async function realizarLogin(email, password) {
  try {
    const res = await fetch("api.php?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Error de autenticación");

    currentUser = data.usuario;
    cerrarAuthGate();
    aplicarRolEnInterfaz();
    showToast(data.mensaje, "success");
    await loadClientes();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function ejecutarLogout() {
  try {
    await fetch("api.php?action=logout");
  } catch (e) {}
  currentUser = null;
  abrirAuthGate();
  aplicarRolEnInterfaz();
  showToast("Sesión cerrada. Por favor selecciona cómo deseas ingresar.", "info");
}

// ==========================================
// 2. APLICACIÓN DE ROLES EN LA INTERFAZ
// ==========================================
function aplicarRolEnInterfaz() {
  const esAdmin = currentUser && currentUser.rol === 'admin';
  const esCliente = currentUser && (currentUser.rol === 'cliente' || currentUser.rol === 'invitado');

  if (esAdmin) {
    document.body.classList.add("role-admin");
    roleBanner.style.display = "none";

    // Header Badge para Admin
    headerAuthZone.innerHTML = `
      <div class="user-badge-header">
        <span>👑 <strong>${currentUser.nombre}</strong></span>
        <span class="user-role-tag admin">ADMINISTRADOR</span>
        <button class="btn-logout" onclick="ejecutarLogout()">Cambiar Cuenta</button>
      </div>
    `;

    // Cargar módulos administrativos
    loadVentas();
    loadDevoluciones();
    cargarProcesosHijos();
    cargarNotificaciones();
    cargarReporteVentaDia();

  } else if (esCliente) {
    document.body.classList.remove("role-admin");

    // Banner informativo para clientes
    roleBanner.style.display = "block";
    roleBanner.innerHTML = currentUser.rol === 'invitado'
      ? `👋 <strong>Modo Invitado activo:</strong> Puedes consultar el menú y ordenar. Para guardar tu historial, <a href="javascript:void(0)" onclick="abrirAuthGate()" style="text-decoration:underline; font-weight:bold;">inicia sesión o regístrate aquí</a>.`
      : `✨ <strong>Bienvenido/a ${currentUser.nombre}:</strong> Tu orden se registrará automáticamente a tu nombre y recibirás tu tiempo de recolección en <em>${currentUser.email}</em>.`;

    // Header Badge para Cliente / Invitado
    headerAuthZone.innerHTML = `
      <div class="user-badge-header">
        <span>☕ <strong>${currentUser.nombre}</strong></span>
        <span class="user-role-tag ${currentUser.rol}">${currentUser.rol.toUpperCase()}</span>
        <button class="btn-logout" onclick="ejecutarLogout()">Cambiar</button>
      </div>
    `;

    // Si es cliente registrado, preseleccionarlo en el POS
    if (currentUser.id_cliente && clienteSelect) {
      clienteSelect.value = currentUser.id_cliente;
    }

  } else {
    // Sin sesión activa
    document.body.classList.remove("role-admin");
    roleBanner.style.display = "none";
    headerAuthZone.innerHTML = `
      <button class="btn-header-login" onclick="abrirAuthGate()">
        <span>👤 Iniciar Sesión / Registro</span>
      </button>
    `;
  }
}

async function checkSession() {
  try {
    const res = await fetch("api.php?action=check_session");
    const json = await res.json();
    if (json.success && json.logged_in) {
      currentUser = json.usuario;
      cerrarAuthGate();
      aplicarRolEnInterfaz();
    } else {
      currentUser = null;
      abrirAuthGate();
      aplicarRolEnInterfaz();
    }
  } catch (err) {
    currentUser = null;
    abrirAuthGate();
    aplicarRolEnInterfaz();
  }
}

// ==========================================
// 3. PRODUCTOS Y CLIENTES
// ==========================================
async function loadProductos() {
  try {
    const res = await fetch("api.php?action=get_productos");
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      products = json.data;
    } else {
      throw new Error("No hay productos");
    }
  } catch (err) {
    if (products.length === 0) {
      products = [
        { id_producto: 1, nombre: "Café americano", categoria: "cafe", precio: 38, stock: 100, icon: "☕", descripcion: "Café intenso y aromático, recién preparado." },
        { id_producto: 2, nombre: "Café con leche", categoria: "cafe", precio: 48, stock: 80, icon: "🥛", descripcion: "Espresso suave con leche cremosa." },
        { id_producto: 3, nombre: "Cappuccino", categoria: "cafe", precio: 55, stock: 75, icon: "☕", descripcion: "Espresso, leche vaporizada y espuma." },
        { id_producto: 4, nombre: "Chocolate caliente", categoria: "cafe", precio: 52, stock: 60, icon: "🍫", descripcion: "Chocolate caliente, cremoso y reconfortante." },
        { id_producto: 5, nombre: "Frappé de café", categoria: "fria", precio: 68, stock: 50, icon: "🧋", descripcion: "Café frío, hielo y crema." },
        { id_producto: 6, nombre: "Té helado", categoria: "fria", precio: 45, stock: 90, icon: "🍹", descripcion: "Té refrescante con hielo y limón." },
        { id_producto: 7, nombre: "Limonada", categoria: "fria", precio: 42, stock: 100, icon: "🍋", descripcion: "Limón natural, agua y un toque dulce." },
        { id_producto: 8, nombre: "Smoothie frutos rojos", categoria: "fria", precio: 70, stock: 45, icon: "🍓", descripcion: "Mezcla cremosa de frutos rojos." },
        { id_producto: 9, nombre: "Chilaquiles", categoria: "comida", precio: 85, stock: 40, icon: "🍳", descripcion: "Totopos, salsa, crema, queso y huevo." },
        { id_producto: 10, nombre: "Sándwich de pollo", categoria: "comida", precio: 78, stock: 35, icon: "🥪", descripcion: "Pan artesanal, pollo y vegetales frescos." },
        { id_producto: 11, nombre: "Croissant", categoria: "comida", precio: 48, stock: 50, icon: "🥐", descripcion: "Hojaldre dorado, ligero y crujiente." },
        { id_producto: 12, nombre: "Hot cakes", categoria: "comida", precio: 72, stock: 30, icon: "🥞", descripcion: "Hot cakes esponjosos con fruta fresca." },
        { id_producto: 13, nombre: "Cheesecake", categoria: "postre", precio: 65, stock: 25, icon: "🍰", descripcion: "Rebanada cremosa con base crujiente." },
        { id_producto: 14, nombre: "Brownie", categoria: "postre", precio: 52, stock: 40, icon: "🍫", descripcion: "Brownie de chocolate suave y tibio." },
        { id_producto: 15, nombre: "Galleta con chispas", categoria: "postre", precio: 35, stock: 60, icon: "🍪", descripcion: "Galleta horneada con chispas de chocolate." },
        { id_producto: 16, nombre: "Pan de plátano", categoria: "postre", precio: 48, stock: 35, icon: "🍌", descripcion: "Pan casero de plátano suave y aromático." }
      ];
    }
  }
  renderMenu();
  renderTablaProductos();
}

async function loadClientes() {
  try {
    const res = await fetch("api.php?action=get_clientes");
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      clients = json.data;
    }
  } catch (err) {
    if (clients.length === 0) {
      clients = [
        { id_cliente: 1, nombre: "Cliente General", email: "general@cafeconleche.com", telefono: "2221234567", fecha_registro: "2026-09-01 10:00:00" },
        { id_cliente: 2, nombre: "Valeria Morales", email: "valeria@example.com", telefono: "2229876543", fecha_registro: "2026-09-01 10:30:00" },
        { id_cliente: 3, nombre: "Carlos Mendoza", email: "carlos.m@example.com", telefono: "2224567890", fecha_registro: "2026-09-01 11:00:00" }
      ];
    }
  }
  renderClientesSelect();
  renderTablaClientes();
}

function renderClientesSelect() {
  clienteSelect.innerHTML = clients.map(c => `
    <option value="${c.id_cliente}">${c.nombre} (${c.email})</option>
  `).join("");

  if (currentUser && currentUser.id_cliente) {
    clienteSelect.value = currentUser.id_cliente;
  }
}

function renderMenu(category = "todos") {
  const visible = category === "todos"
    ? products
    : products.filter(p => (p.categoria || p.category) === category);

  menuGrid.innerHTML = visible.map(product => {
    const pid = product.id_producto || product.id;
    const isLowStock = product.stock <= 5;
    return `
      <article class="product">
        <span class="stock-tag ${isLowStock ? 'low' : ''}">Stock: ${product.stock}</span>
        <div class="product-image">${product.icon || '☕'}</div>
        <div class="product-body">
          <h3>${product.nombre || product.name}</h3>
          <p>${product.descripcion || product.description || ''}</p>
          <div class="product-bottom">
            <span class="price">${money(product.precio || product.price)}</span>
            <button class="btn primary add-btn" ${product.stock <= 0 ? 'disabled style="opacity:0.5"' : ''} onclick="addToCart(${pid})">
              ${product.stock > 0 ? '+ Agregar' : 'Agotado'}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderTablaProductos() {
  const tbody = document.getElementById("tablaProductosBody");
  if (!tbody) return;
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><strong>#${p.id_producto || p.id}</strong></td>
      <td style="font-size: 1.3rem;">${p.icon || '☕'}</td>
      <td><strong>${p.nombre || p.name}</strong></td>
      <td>${p.categoria || p.category}</td>
      <td><strong>${money(p.precio || p.price)}</strong></td>
      <td><span style="font-weight: bold; color: ${p.stock <= 5 ? '#c62828' : '#2e7d32'};">${p.stock} unid.</span></td>
      <td><span class="status-badge status-completada">${p.estado || 'activo'}</span></td>
    </tr>
  `).join("");
}

function renderTablaClientes() {
  const tbody = document.getElementById("tablaClientesBody");
  if (!tbody) return;
  tbody.innerHTML = clients.map(c => `
    <tr>
      <td>#${c.id_cliente}</td>
      <td><strong>${c.nombre}</strong></td>
      <td>${c.email}</td>
      <td>${c.telefono || 'N/A'}</td>
      <td>${c.fecha_registro || 'Hoy'}</td>
    </tr>
  `).join("");
}

// ==========================================
// 4. CARRITO, POS Y TIEMPO DE RECOLECCIÓN
// ==========================================
function addToCart(id) {
  const pid = Number(id);
  const product = products.find(p => (p.id_producto || p.id) === pid);
  if (!product) return;

  const item = cart.find(i => i.id_producto === pid);
  const currentInCart = item ? item.quantity : 0;

  if (currentInCart + 1 > product.stock) {
    showToast(`Stock insuficiente. Solo hay ${product.stock} disponibles.`, "error");
    return;
  }

  if (item) {
    item.quantity++;
  } else {
    cart.push({
      id_producto: pid,
      nombre: product.nombre || product.name,
      precio: Number(product.precio || product.price),
      icon: product.icon || '☕',
      quantity: 1
    });
  }
  renderCart();
  showToast(`"${product.nombre || product.name}" agregado al pedido`);
}

function changeQuantity(id, amount) {
  const pid = Number(id);
  const item = cart.find(i => i.id_producto === pid);
  if (!item) return;

  const product = products.find(p => (p.id_producto || p.id) === pid);
  if (amount > 0 && product && (item.quantity + amount > product.stock)) {
    showToast(`Límite de stock alcanzado (${product.stock})`, "error");
    return;
  }

  item.quantity += amount;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id_producto !== pid);
  }
  renderCart();
}

function removeItem(id) {
  const pid = Number(id);
  cart = cart.filter(i => i.id_producto !== pid);
  renderCart();
  showToast("Producto eliminado del ticket");
}

function renderCart() {
  if (cart.length === 0) {
    cartItems.innerHTML = `<div class="empty-cart">Tu pedido está vacío.<br>Agrega productos del menú.</div>`;
  } else {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-icon">${item.icon}</div>
        <div>
          <h4>${item.nombre}</h4>
          <small>${money(item.precio)} c/u</small>
          <div class="qty">
            <button onclick="changeQuantity(${item.id_producto}, -1)">−</button>
            <strong>${item.quantity}</strong>
            <button onclick="changeQuantity(${item.id_producto}, 1)">+</button>
          </div>
        </div>
        <div style="text-align:right">
          <strong>${money(item.precio * item.quantity)}</strong>
          <br>
          <button class="remove" onclick="removeItem(${item.id_producto})">Quitar</button>
        </div>
      </div>
    `).join("");
  }

  const subtotal = cart.reduce((sum, item) => sum + item.precio * item.quantity, 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  subtotalEl.textContent = money(subtotal);
  totalEl.textContent = money(subtotal);
  cartCount.textContent = `${count} ${count === 1 ? "producto" : "productos"}`;
}

// PROCESAR VENTA (CLIENTES / INVITADOS / ADMIN)
document.getElementById("checkoutBtn").addEventListener("click", async () => {
  if (cart.length === 0) {
    showToast("Agrega al menos un producto al pedido", "error");
    return;
  }

  const idCliente = clienteSelect.value;
  if (!idCliente) {
    showToast("Selecciona el cliente que realiza el pedido", "error");
    return;
  }

  const tiempoEstimado = parseInt(document.getElementById("tiempoEstimadoSelect").value, 10) || 15;

  const items = cart.map(i => ({
    id_producto: i.id_producto,
    cantidad: i.quantity,
    precio_unitario: i.precio
  }));

  try {
    const res = await fetch("api.php?action=procesar_venta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_cliente: idCliente,
        items: items,
        tiempo_estimado_min: tiempoEstimado
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Error al procesar la venta");

    showToast(data.mensaje, "success");
    cart = [];
    renderCart();
    await loadProductos();

    // Si es administrador, refrescar los paneles gerenciales
    if (currentUser && currentUser.rol === 'admin') {
      await loadVentas();
      await cargarProcesosHijos();
      await cargarNotificaciones();
      await cargarReporteVentaDia();
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
});

document.getElementById("clearBtn").addEventListener("click", () => {
  if (cart.length === 0) return;
  cart = [];
  renderCart();
  showToast("Pedido vaciado");
});

// ==========================================
// 5. MÓDULO DE REPORTES ESTADÍSTICOS (SOLO ADMIN)
// ==========================================
async function cargarReporteVentaDia() {
  if (!currentUser || currentUser.rol !== 'admin') return;

  const fechaInput = document.getElementById("fechaReporteDia").value || new Date().toISOString().split("T")[0];
  try {
    const res = await fetch(`api.php?action=reporte_venta_dia&fecha=${fechaInput}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    document.getElementById("kpiDiaTotal").textContent = money(json.resumen.monto_total || 0);
    document.getElementById("kpiDiaPedidos").textContent = `${json.resumen.total_pedidos || 0} órdenes`;
    document.getElementById("kpiDiaPromedio").textContent = money(json.resumen.ticket_promedio || 0);

    const tbody = document.getElementById("tablaReporteDiaBody");
    if (json.ventas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay ventas registradas en la fecha seleccionada (${fechaInput}).</td></tr>`;
      return;
    }

    tbody.innerHTML = json.ventas.map(v => `
      <tr>
        <td><strong>#${v.id_venta}</strong></td>
        <td>${v.fecha.split(" ")[1] || v.fecha}</td>
        <td>${v.cliente}</td>
        <td>${v.items} producto(s)</td>
        <td><strong>${money(v.total)}</strong></td>
        <td><span class="status-badge status-${v.estado}">${v.estado}</span></td>
      </tr>
    `).join("");
  } catch (err) {
    console.warn("Reporte día:", err.message);
  }
}

async function cargarReporteProductosDia() {
  if (!currentUser || currentUser.rol !== 'admin') return;

  const fechaInput = document.getElementById("fechaReporteProd").value || new Date().toISOString().split("T")[0];
  try {
    const res = await fetch(`api.php?action=reporte_productos_dia&fecha=${fechaInput}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    const tbody = document.getElementById("tablaReporteProdBody");
    if (json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Sin movimientos para esta fecha.</td></tr>`;
      return;
    }

    tbody.innerHTML = json.data.map(p => `
      <tr>
        <td>${p.icon || '☕'} <strong>${p.nombre}</strong></td>
        <td>${p.categoria}</td>
        <td>${money(p.precio)}</td>
        <td><strong style="color: ${p.unidades_vendidas > 0 ? '#2e7d32' : '#777'};">${p.unidades_vendidas} unid.</strong></td>
        <td><strong style="color: #4a2c20;">${money(p.total_recaudado)}</strong></td>
      </tr>
    `).join("");
  } catch (err) {
    console.warn("Reporte productos:", err.message);
  }
}

async function cargarReportePeriodo() {
  if (!currentUser || currentUser.rol !== 'admin') return;

  const inicio = document.getElementById("fechaPeriodoInicio").value;
  const fin = document.getElementById("fechaPeriodoFin").value;

  if (!inicio || !fin) {
    showToast("Selecciona fecha de inicio y fin para el periodo", "error");
    return;
  }

  try {
    const res = await fetch(`api.php?action=reporte_por_periodo&inicio=${inicio}&fin=${fin}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    document.getElementById("kpiPeriodoTotal").textContent = money(json.resumen.gran_total || 0);
    document.getElementById("kpiPeriodoPedidos").textContent = `${json.resumen.total_pedidos || 0} órdenes`;
    document.getElementById("kpiPeriodoPromedio").textContent = money(json.resumen.promedio_ticket || 0);

    const tbodyDias = document.getElementById("tablaPeriodoDiasBody");
    if (json.desglose_dias.length === 0) {
      tbodyDias.innerHTML = `<tr><td colspan="3" style="text-align:center;">No hubo ventas en este rango de fechas.</td></tr>`;
    } else {
      tbodyDias.innerHTML = json.desglose_dias.map(d => `
        <tr>
          <td><strong>${d.dia}</strong></td>
          <td>${d.num_ventas} orden(es)</td>
          <td><strong>${money(d.total_dia)}</strong></td>
        </tr>
      `).join("");
    }

    const tbodyTop = document.getElementById("tablaPeriodoTopBody");
    if (json.top_productos.length === 0) {
      tbodyTop.innerHTML = `<tr><td colspan="3" style="text-align:center;">Sin productos vendidos en el periodo.</td></tr>`;
    } else {
      tbodyTop.innerHTML = json.top_productos.map((tp, idx) => `
        <tr>
          <td><strong>#${idx + 1}</strong> ${tp.icon || '☕'} ${tp.nombre}</td>
          <td><strong>${tp.cantidad_total} unidades</strong></td>
          <td><strong style="color: #2e7d32;">${money(tp.ingreso_generado)}</strong></td>
        </tr>
      `).join("");
    }
  } catch (err) {
    showToast(`Error reporte periodo: ${err.message}`, "error");
  }
}

// ==========================================
// 6. PROCESOS HIJOS & AVISOS (SOLO ADMIN)
// ==========================================
async function cargarProcesosHijos() {
  if (!currentUser || currentUser.rol !== 'admin') return;

  const idVentaFiltro = document.getElementById("filtroIdVentaProceso")?.value;
  const contenedor = document.getElementById("contenedorProcesosHijos");
  if (!contenedor) return;

  try {
    let url = "api.php?action=get_procesos_hijos";
    if (idVentaFiltro) url += `&id_venta=${idVentaFiltro}`;

    const res = await fetch(url);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error("No se pudieron cargar las etapas");

    if (json.data.length === 0) {
      contenedor.innerHTML = `<p class="muted" style="text-align:center; padding: 20px;">No hay etapas activas registradas para el filtro actual.</p>`;
      return;
    }

    const agrupado = {};
    json.data.forEach(et => {
      if (!agrupado[et.id_venta]) agrupado[et.id_venta] = [];
      agrupado[et.id_venta].push(et);
    });

    contenedor.innerHTML = Object.keys(agrupado).map(idVenta => {
      const etapas = agrupado[idVenta];
      const cliNombre = etapas[0].cliente_nombre || `Ticket #${idVenta}`;
      const todasCompletas = etapas.every(e => e.estado === 'completado');

      return `
        <div style="background: #fff; border-radius: 14px; padding: 18px; margin-bottom: 18px; box-shadow: var(--shadow-sm); border: 1px solid #ebd9c5;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div>
              <h3 style="color: var(--brown); margin: 0;">Ticket #${idVenta} — Cliente: ${cliNombre}</h3>
              <small class="muted">Procesos hijos en paralelo (Caja, Barra, Cocina, Entrega)</small>
            </div>
            <div>
              ${todasCompletas 
                ? `<span class="status-badge status-listo_para_recolectar">✓ Todas las etapas listas</span>` 
                : `<button class="btn btn-special" style="padding: 6px 12px; font-size: 0.8rem;" onclick="notificarPedidoListoManual(${idVenta})">🚀 Marcar Todo Listo & Avisar por Correo</button>`
              }
            </div>
          </div>

          <div class="stages-list">
            ${etapas.map(et => `
              <div class="stage-item">
                <div class="stage-info">
                  <span class="stage-badge-area">${et.area}</span>
                  <div>
                    <strong>${et.subproceso}</strong>
                    <br>
                    <small class="muted">Responsable: ${et.responsable || 'Equipo'}</small>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="status-badge status-${et.estado}">${et.estado.replace('_', ' ')}</span>
                  <select class="input-style" style="width: auto; padding: 5px 8px; font-size: 0.8rem;" onchange="cambiarEstadoEtapa(${et.id_etapa}, this.value)">
                    <option value="pendiente" ${et.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="en_progreso" ${et.estado === 'en_progreso' ? 'selected' : ''}>En Progreso</option>
                    <option value="completado" ${et.estado === 'completado' ? 'selected' : ''}>Completado</option>
                  </select>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    contenedor.innerHTML = `<p style="color: #c62828;">Error cargando procesos hijos: ${err.message}</p>`;
  }
}

async function cambiarEstadoEtapa(idEtapa, nuevoEstado) {
  try {
    const res = await fetch("api.php?action=actualizar_subproceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_etapa: idEtapa, estado: nuevoEstado })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);

    if (data.notificado_listo) {
      showToast("¡Todas las etapas terminadas! Se envió correo avisando que el pedido está LISTO.", "success");
    } else {
      showToast("Subproceso actualizado", "info");
    }
    await cargarProcesosHijos();
    await loadVentas();
    await cargarNotificaciones();
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

async function notificarPedidoListoManual(idVenta) {
  try {
    const res = await fetch("api.php?action=notificar_pedido_listo_manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_venta: idVenta })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);

    showToast(data.mensaje, "success");
    await cargarProcesosHijos();
    await loadVentas();
    await cargarNotificaciones();
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

async function cargarNotificaciones() {
  if (!currentUser || currentUser.rol !== 'admin') return;

  const tbody = document.getElementById("tablaNotificacionesBody");
  if (!tbody) return;
  try {
    const res = await fetch("api.php?action=get_notificaciones");
    const json = await res.json();
    if (json.success && json.data) {
      if (json.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay registros de correos enviados.</td></tr>`;
        return;
      }
      tbody.innerHTML = json.data.map(n => `
        <tr>
          <td>#${n.id_notificacion}</td>
          <td><strong>Ticket #${n.id_venta}</strong></td>
          <td>${n.destinatario}</td>
          <td><span class="status-badge status-recibido">${n.tipo.replace('_', ' ')}</span></td>
          <td><em>${n.asunto}</em></td>
          <td>${n.enviado_el}</td>
          <td><span style="color: #2e7d32; font-weight: bold;">✓ ${n.estado_envio}</span></td>
        </tr>
      `).join("");
    }
  } catch (e) {}
}

// ==========================================
// 7. GESTIÓN DE VENTAS Y DEVOLUCIONES (SOLO ADMIN)
// ==========================================
async function loadVentas() {
  if (!currentUser || currentUser.rol !== 'admin') return;

  const tbody = document.getElementById("tablaVentasBody");
  if (!tbody) return;
  try {
    const res = await fetch("api.php?action=get_ventas");
    const json = await res.json();
    if (json.success && json.data) {
      if (json.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay ventas registradas.</td></tr>`;
        return;
      }
      tbody.innerHTML = json.data.map(v => `
        <tr>
          <td><strong>Ticket #${v.id_venta}</strong></td>
          <td>${v.fecha}</td>
          <td>${v.cliente}</td>
          <td>⏱️ ${v.tiempo_estimado_min || 15} min</td>
          <td><strong>${money(v.total)}</strong></td>
          <td><span class="status-badge status-${v.estado}">${v.estado.replace('_', ' ')}</span></td>
          <td style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-info" style="padding: 4px 8px; font-size: 0.75rem;" onclick="notificarPedidoListoManual(${v.id_venta})">
              🔔 Avisar Listo
            </button>
            <button class="btn btn-special" style="padding: 4px 8px; font-size: 0.75rem;" onclick="iniciarDevolucionVenta(${v.id_venta})">
              🔄 Devolver
            </button>
          </td>
        </tr>
      `).join("");
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#c62828;">Error de conexión a BD.</td></tr>`;
  }
}

async function loadDevoluciones() {
  if (!currentUser || currentUser.rol !== 'admin') return;

  const tbody = document.getElementById("tablaDevolucionesBody");
  if (!tbody) return;
  try {
    const res = await fetch("api.php?action=get_devoluciones");
    const json = await res.json();
    if (json.success && json.data) {
      if (json.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No hay devoluciones registradas.</td></tr>`;
        return;
      }
      tbody.innerHTML = json.data.map(d => `
        <tr>
          <td><strong>#DEV-${d.id_devolucion}</strong></td>
          <td><strong>Ticket #${d.id_venta}</strong></td>
          <td>${d.fecha_devolucion}</td>
          <td>${d.cliente_nombre}</td>
          <td>${d.icon || '☕'} ${d.producto_nombre}</td>
          <td><strong>${d.cantidad} unid.</strong></td>
          <td style="color:#b71c1c; font-weight:800;">−${money(d.monto_reembolsado)}</td>
          <td><em>${d.motivo}</em></td>
          <td>${d.reintegrar_stock == 1 ? '<span style="color:#2e7d32; font-weight:bold;">✓ Sí (+Stock)</span>' : '<span style="color:#c62828;">✗ No (Merma)</span>'}</td>
        </tr>
      `).join("");
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#c62828;">Error consultando devoluciones.</td></tr>`;
  }
}

function iniciarDevolucionVenta(idVenta) {
  document.getElementById("devIdVenta").value = idVenta;
  abrirModalDevolucionManual();
  cargarDetallesParaDevolucion();
}

function abrirModalDevolucionManual() {
  document.getElementById("modalDevolucion").classList.add("open");
}

function cerrarModalDevolucion() {
  document.getElementById("modalDevolucion").classList.remove("open");
  document.getElementById("formDevolucion").reset();
  document.getElementById("infoVentaContainer").style.display = "none";
}

async function cargarDetallesParaDevolucion() {
  const idVenta = document.getElementById("devIdVenta").value;
  const prodSelect = document.getElementById("devIdProducto");
  const infoBox = document.getElementById("infoVentaContainer");

  if (!idVenta || idVenta <= 0) {
    infoBox.style.display = "none";
    prodSelect.innerHTML = `<option value="">Ingresa un número de ticket válido</option>`;
    return;
  }

  try {
    const res = await fetch(`api.php?action=get_venta_detalle&id_venta=${idVenta}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    infoBox.style.display = "block";
    document.getElementById("devInfoCliente").textContent = json.venta.cliente_nombre;
    document.getElementById("devInfoFecha").textContent = json.venta.fecha;
    document.getElementById("devInfoTotal").textContent = money(json.venta.total);

    currentSaleDetails = json.detalles;

    if (json.detalles.length === 0) {
      prodSelect.innerHTML = `<option value="">Esta venta no contiene productos</option>`;
      return;
    }

    prodSelect.innerHTML = json.detalles.map(d => {
      const disponible = d.cantidad - d.cantidad_devuelta;
      return `<option value="${d.id_producto}" data-disponible="${disponible}" ${disponible <= 0 ? 'disabled' : ''}>
        ${d.icon} ${d.producto_nombre} (Comprados: ${d.cantidad} | Devueltos: ${d.cantidad_devuelta} | Elegibles: ${disponible})
      </option>`;
    }).join("");

    actualizarMaxDevolucion();
  } catch (err) {
    infoBox.style.display = "none";
    prodSelect.innerHTML = `<option value="">Error: ${err.message}</option>`;
  }
}

function actualizarMaxDevolucion() {
  const prodSelect = document.getElementById("devIdProducto");
  const cantInput = document.getElementById("devCantidad");
  const help = document.getElementById("devMaxHelp");

  const selectedOpt = prodSelect.options[prodSelect.selectedIndex];
  if (!selectedOpt || !selectedOpt.dataset.disponible) return;

  const max = parseInt(selectedOpt.dataset.disponible, 10);
  cantInput.max = max;
  cantInput.value = Math.min(1, max);
  help.textContent = `Máximo elegible a devolver: ${max} unidad(es)`;
}

async function enviarDevolucion(e) {
  e.preventDefault();
  const idVenta = document.getElementById("devIdVenta").value;
  const idProducto = document.getElementById("devIdProducto").value;
  const cantidad = document.getElementById("devCantidad").value;
  const motivo = document.getElementById("devMotivo").value;
  const reintegrarStock = document.getElementById("devReintegrarStock").value === "1";

  if (!idProducto) {
    showToast("Selecciona un producto para devolver", "error");
    return;
  }

  try {
    const res = await fetch("api.php?action=procesar_devolucion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_venta: idVenta,
        id_producto: idProducto,
        cantidad: cantidad,
        motivo: motivo,
        reintegrar_stock: reintegrarStock
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Error al procesar devolución");

    showToast(data.mensaje, "special");
    cerrarModalDevolucion();
    await loadProductos();
    await loadVentas();
    await loadDevoluciones();
    await cargarNotificaciones();
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

// ==========================================
// 8. REGISTRO DE CLIENTES RÁPIDO
// ==========================================
function abrirModalCliente() {
  document.getElementById("modalCliente").classList.add("open");
}

function cerrarModalCliente() {
  document.getElementById("modalCliente").classList.remove("open");
  document.getElementById("formCliente").reset();
}

document.getElementById("btnNuevoCliente")?.addEventListener("click", (e) => {
  e.preventDefault();
  abrirModalCliente();
});

async function guardarCliente(e) {
  e.preventDefault();
  const nombre = document.getElementById("cliNombre").value.trim();
  const email = document.getElementById("cliEmail").value.trim();
  const telefono = document.getElementById("cliTelefono").value.trim();
  const password = document.getElementById("cliPassword").value.trim();

  try {
    const res = await fetch("api.php?action=create_cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, telefono, password })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "No se pudo registrar");

    showToast(data.mensaje, "success");
    cerrarModalCliente();
    await loadClientes();
    clienteSelect.value = data.id_cliente;
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

// ==========================================
// 9. PESTAÑAS (TABS) & FILTROS
// ==========================================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const parentContainer = btn.parentElement;
    parentContainer.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    
    const targetId = btn.dataset.tab;
    const tabZone = parentContainer.parentElement;
    tabZone.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));

    btn.classList.add("active");
    const targetTab = document.getElementById(targetId);
    if (targetTab) {
      targetTab.classList.add("active");
      if (targetId === "tab-rep-dia") cargarReporteVentaDia();
      if (targetId === "tab-rep-prod") cargarReporteProductosDia();
      if (targetId === "tab-rep-periodo") cargarReportePeriodo();
      if (targetId === "tab-ventas") loadVentas();
      if (targetId === "tab-devoluciones") loadDevoluciones();
      if (targetId === "tab-productos") loadProductos();
      if (targetId === "tab-clientes") loadClientes();
    }
  });
});

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector(".filter.active").classList.remove("active");
    button.classList.add("active");
    renderMenu(button.dataset.category);
  });
});

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("navLinks").classList.toggle("open");
});

document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    document.getElementById("navLinks").classList.remove("open");
  });
});

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.getElementById("year").textContent = new Date().getFullYear();

const hoy = new Date().toISOString().split("T")[0];
const primerDiaMes = hoy.substring(0, 8) + "01";

if (document.getElementById("fechaReporteDia")) document.getElementById("fechaReporteDia").value = hoy;
if (document.getElementById("fechaReporteProd")) document.getElementById("fechaReporteProd").value = hoy;
if (document.getElementById("fechaPeriodoInicio")) document.getElementById("fechaPeriodoInicio").value = primerDiaMes;
if (document.getElementById("fechaPeriodoFin")) document.getElementById("fechaPeriodoFin").value = hoy;

window.addEventListener("DOMContentLoaded", async () => {
  await checkSession();
  await loadProductos();
  await loadClientes();
  renderCart();
});
