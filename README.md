# Café con Leche POS - Versión 3.0 (Gate de Entrada, Control de Acceso Estricto y Separación de Roles)

Esta versión implementa la experiencia de usuario y seguridad solicitada:

---

## 🚪 1. Pantalla de Entrada Obligatoria (Welcome Gate)
Al abrir el sistema por primera vez o al cerrar sesión, se muestra inmediatamente la pantalla de bienvenida con tres modalidades:
1. **Iniciar Sesión:** Accede con tus credenciales registradas.
2. **Registrarse como Cliente:** Formulario de alta rápida con nombre, correo, teléfono y contraseña. Inicia sesión automáticamente tras el registro.
3. **Entrar como Invitado:** Permite explorar el menú y comprar de inmediato sin crear contraseñas.
4. **Botones de Prueba Rápida (1 Clic):**
   - 👑 **Admin:** Ingresa al instante como administrador (`admin@cafeconleche.com` / `admin123`).
   - ☕ **Cliente:** Ingresa al instante como cliente (`valeria@example.com` / `cliente123`).
   - 🚶 **Invitado:** Ingresa al instante en modo público.

---

## 🔒 2. Separación Estricta de Roles en Interfaz y Backend

### ☕ Vista del Cliente / Invitado
- **Solo ve:** Portada (Hero), Menú con inventario en tiempo real y el Punto de Venta (Caja / Carrito).
- **Oculto al 100%:** Los enlaces de navegación y las secciones de **Reportes**, **Procesos Hijos**, **Historial de Ventas**, **Notificaciones** y **Devoluciones** no aparecen en la pantalla ni en el menú de navegación.
- **Seguridad en Backend:** La API PHP valida el rol de administrador (`verificarAdmin()`); cualquier intento no autorizado de consulta retorna error `403 Acceso Denegado`.

### 👑 Vista del Administrador
- **Acceso total:** La barra de navegación y la página despliegan:
  - 📊 **Módulo de Reportes:** Venta del día, venta de productos en el día y venta por periodos con top 10.
  - ⚙️ **Procesos Hijos:** Monitoreo y cambio de estado de las 4 etapas (Caja, Barra, Cocina, Entrega).
  - 🔄 **Operación Especial de Devoluciones:** Tabla de auditoría, conciliación de tickets y restock automático por Trigger.
  - 📬 **Bitácora de Notificaciones:** Registro de correos electrónicos enviados con tiempos de recolección y avisos de orden lista.

---

## 🚀 Puesta en Marcha en XAMPP

1. Copia la carpeta `cafe_con_leche_v3` dentro de `C:\xampp\htdocs\cafe_con_leche`.
2. Enciende **Apache** y **MySQL** en XAMPP.
3. Si no has importado la base de datos, entra a `http://localhost/phpmyadmin/`, pulsa **Importar** y selecciona `database.sql`.
4. Abre en tu navegador:
   ```url
   http://localhost/cafe_con_leche/
   ```
