<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once 'db.php';
require_once 'mailer.php';

$action = $_GET['action'] ?? '';

// Función auxiliar para verificar si el usuario es administrador
function verificarAdmin() {
    if (!isset($_SESSION['usuario']) || $_SESSION['usuario']['rol'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado. Esta sección es exclusiva para Administradores.']);
        exit;
    }
}

try {
    switch ($action) {

        // ==========================================
        // 1. AUTENTICACIÓN Y SESIÓN (LOGIN / REGISTRO / INVITADO / LOGOUT)
        // ==========================================
        case 'login':
            $data = json_decode(file_get_contents('php://input'), true);
            $email = trim($data['email'] ?? '');
            $password = trim($data['password'] ?? '');

            if (!$email || !$password) {
                throw new Exception('Debes ingresar tu correo y contraseña.');
            }

            $stmt = $pdo->prepare("SELECT id_usuario, nombre, email, password, rol FROM usuarios WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            $passHash = hash('sha256', $password);
            if (!$user || ($user['password'] !== $passHash && $user['password'] !== $password)) {
                throw new Exception('Credenciales incorrectas. Verifica tu correo y contraseña.');
            }

            // Guardar en sesión
            $_SESSION['usuario'] = [
                'id_usuario' => $user['id_usuario'],
                'nombre' => $user['nombre'],
                'email' => $user['email'],
                'rol' => $user['rol']
            ];

            // Si es cliente, obtener id_cliente
            $idCliente = null;
            $stmtCli = $pdo->prepare("SELECT id_cliente FROM clientes WHERE email = ?");
            $stmtCli->execute([$user['email']]);
            $cliRow = $stmtCli->fetch();
            if ($cliRow) {
                $idCliente = $cliRow['id_cliente'];
            }

            $_SESSION['usuario']['id_cliente'] = $idCliente;

            echo json_encode([
                'success' => true,
                'usuario' => $_SESSION['usuario'],
                'mensaje' => "¡Bienvenido/a {$user['nombre']}! Has ingresado como " . strtoupper($user['rol'])
            ]);
            break;

        case 'registro_cliente':
            $data = json_decode(file_get_contents('php://input'), true);
            $nombre = trim($data['nombre'] ?? '');
            $email = trim($data['email'] ?? '');
            $telefono = trim($data['telefono'] ?? '');
            $password = trim($data['password'] ?? '');

            if (!$nombre || !$email || !$password) {
                throw new Exception('El nombre, correo y contraseña son obligatorios.');
            }

            // Validar que el correo no exista ya
            $stmtCheck = $pdo->prepare("SELECT id_usuario FROM usuarios WHERE email = ?");
            $stmtCheck->execute([$email]);
            if ($stmtCheck->fetch()) {
                throw new Exception('Este correo ya se encuentra registrado. Intenta iniciar sesión.');
            }

            $pdo->beginTransaction();

            $passHash = hash('sha256', $password);
            $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, 'cliente')");
            $stmtUser->execute([$nombre, $email, $passHash]);
            $idUsuario = $pdo->lastInsertId();

            $stmtCli = $pdo->prepare("INSERT INTO clientes (id_usuario, nombre, email, telefono) VALUES (?, ?, ?, ?)");
            $stmtCli->execute([$idUsuario, $nombre, $email, $telefono]);
            $idCliente = $pdo->lastInsertId();

            $pdo->commit();

            // Iniciar sesión automáticamente
            $_SESSION['usuario'] = [
                'id_usuario' => $idUsuario,
                'nombre' => $nombre,
                'email' => $email,
                'rol' => 'cliente',
                'id_cliente' => $idCliente
            ];

            echo json_encode([
                'success' => true,
                'usuario' => $_SESSION['usuario'],
                'mensaje' => "¡Cuenta creada exitosamente! Bienvenido/a a Café con Leche, $nombre."
            ]);
            break;

        case 'login_invitado':
            // Cuenta de invitado temporal
            $_SESSION['usuario'] = [
                'id_usuario' => 0,
                'nombre' => 'Invitado',
                'email' => 'general@cafeconleche.com',
                'rol' => 'invitado',
                'id_cliente' => 1 // ID del Cliente General
            ];

            echo json_encode([
                'success' => true,
                'usuario' => $_SESSION['usuario'],
                'mensaje' => 'Has ingresado en modo Invitado. Puedes explorar el menú y realizar pedidos rápidos.'
            ]);
            break;

        case 'logout':
            $_SESSION = [];
            if (ini_get("session.use_cookies")) {
                $params = session_get_cookie_params();
                setcookie(session_name(), '', time() - 42000,
                    $params["path"], $params["domain"],
                    $params["secure"], $params["httponly"]
                );
            }
            session_destroy();
            echo json_encode(['success' => true, 'mensaje' => 'Sesión cerrada exitosamente']);
            break;

        case 'check_session':
            if (isset($_SESSION['usuario'])) {
                echo json_encode(['success' => true, 'logged_in' => true, 'usuario' => $_SESSION['usuario']]);
            } else {
                echo json_encode(['success' => true, 'logged_in' => false]);
            }
            break;

        // ==========================================
        // 2. PRODUCTOS Y CLIENTES
        // ==========================================
        case 'get_productos':
            $stmt = $pdo->query("SELECT * FROM productos WHERE estado = 'activo' ORDER BY id_producto ASC");
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
            break;

        case 'get_clientes':
            $stmt = $pdo->query("SELECT * FROM clientes ORDER BY id_cliente ASC");
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
            break;

        case 'create_cliente':
            $data = json_decode(file_get_contents('php://input'), true);
            $nombre = trim($data['nombre'] ?? '');
            $email = trim($data['email'] ?? '');
            $telefono = trim($data['telefono'] ?? '');
            $password = trim($data['password'] ?? 'cliente123');

            if (!$nombre || !$email) {
                throw new Exception('El nombre y el correo electrónico son obligatorios.');
            }

            $pdo->beginTransaction();

            $passHash = hash('sha256', $password);
            $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, 'cliente') ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)");
            $stmtUser->execute([$nombre, $email, $passHash]);
            $idUsuario = $pdo->lastInsertId() ?: null;

            $stmtCli = $pdo->prepare("INSERT INTO clientes (id_usuario, nombre, email, telefono) VALUES (?, ?, ?, ?)");
            $stmtCli->execute([$idUsuario, $nombre, $email, $telefono]);
            $idCliente = $pdo->lastInsertId();

            $pdo->commit();
            echo json_encode(['success' => true, 'id_cliente' => $idCliente, 'mensaje' => 'Cliente registrado con éxito.']);
            break;

        // ==========================================
        // 3. PROCESAR VENTA / PEDIDO (CLIENTES, INVITADOS Y ADMIN)
        // ==========================================
        case 'procesar_venta':
            $data = json_decode(file_get_contents('php://input'), true);
            $id_cliente = intval($data['id_cliente'] ?? 0);
            $items = $data['items'] ?? [];
            $tiempo_estimado = intval($data['tiempo_estimado_min'] ?? 15);

            if ($id_cliente <= 0 || empty($items)) {
                throw new Exception('Debes indicar un cliente registrado y al menos un producto.');
            }

            $pdo->beginTransaction();

            $stmtCli = $pdo->prepare("SELECT nombre, email FROM clientes WHERE id_cliente = ?");
            $stmtCli->execute([$id_cliente]);
            $cliente = $stmtCli->fetch();
            if (!$cliente) throw new Exception('El cliente no existe.');

            $total = 0;
            $itemsValidados = [];
            $stmtCheckStock = $pdo->prepare("SELECT id_producto, nombre, precio, stock FROM productos WHERE id_producto = ? FOR UPDATE");

            foreach ($items as $it) {
                $stmtCheckStock->execute([$it['id_producto']]);
                $prod = $stmtCheckStock->fetch();
                if (!$prod) throw new Exception("Producto #{$it['id_producto']} no encontrado.");

                $cant = intval($it['cantidad']);
                if ($cant <= 0) throw new Exception("Cantidad inválida para {$prod['nombre']}.");
                if ($prod['stock'] < $cant) {
                    throw new Exception("Stock insuficiente para '{$prod['nombre']}'. Disponible: {$prod['stock']}.");
                }

                $total += $prod['precio'] * $cant;
                $itemsValidados[] = [
                    'id_producto' => $prod['id_producto'],
                    'cantidad' => $cant,
                    'precio_unitario' => $prod['precio']
                ];
            }

            $horaEstimada = date('Y-m-d H:i:s', strtotime("+{$tiempo_estimado} minutes"));

            // Insertar venta (proceso padre).
            // El Trigger trg_crear_subprocesos_pedido insertará automáticamente las 4 etapas hijas
            $stmtVenta = $pdo->prepare("
                INSERT INTO ventas (id_cliente, total, estado, tiempo_estimado_min, hora_estimada_entrega) 
                VALUES (?, ?, 'en_preparacion', ?, ?)
            ");
            $stmtVenta->execute([$id_cliente, $total, $tiempo_estimado, $horaEstimada]);
            $id_venta = $pdo->lastInsertId();

            $stmtDetalle = $pdo->prepare("INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)");
            $stmtUpdateStock = $pdo->prepare("UPDATE productos SET stock = stock - ? WHERE id_producto = ?");

            foreach ($itemsValidados as $it) {
                $stmtDetalle->execute([$id_venta, $it['id_producto'], $it['cantidad'], $it['precio_unitario']]);
                $stmtUpdateStock->execute([$it['cantidad'], $it['id_producto']]);
            }

            // Disparar correo de tiempo de recolección al cliente
            $notif = enviarCorreoNotificacion($pdo, $id_venta, $cliente['email'], $cliente['nombre'], 'tiempo_recoleccion', $tiempo_estimado);

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'id_venta' => $id_venta,
                'total' => $total,
                'tiempo_estimado_min' => $tiempo_estimado,
                'notificacion' => $notif,
                'mensaje' => "¡Orden #$id_venta procesada! Se envió correo a {$cliente['email']} con tiempo estimado de {$tiempo_estimado} min."
            ]);
            break;

        // ==========================================
        // 4. PROCESOS HIJOS (SOLO ADMIN)
        // ==========================================
        case 'get_procesos_hijos':
            verificarAdmin();
            $id_venta = intval($_GET['id_venta'] ?? 0);
            if ($id_venta > 0) {
                $stmt = $pdo->prepare("SELECT * FROM pedidos_etapas WHERE id_venta = ? ORDER BY id_etapa ASC");
                $stmt->execute([$id_venta]);
            } else {
                $stmt = $pdo->query("
                    SELECT pe.*, v.estado AS estado_venta, c.nombre AS cliente_nombre 
                    FROM pedidos_etapas pe
                    JOIN ventas v ON pe.id_venta = v.id_venta
                    JOIN clientes c ON v.id_cliente = c.id_cliente
                    ORDER BY pe.id_venta DESC, pe.id_etapa ASC
                    LIMIT 40
                ");
            }
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
            break;

        case 'actualizar_subproceso':
            verificarAdmin();
            $data = json_decode(file_get_contents('php://input'), true);
            $id_etapa = intval($data['id_etapa'] ?? 0);
            $nuevo_estado = $data['estado'] ?? 'en_progreso';

            if ($id_etapa <= 0) throw new Exception('ID de etapa no válido.');

            $finalizado_en = ($nuevo_estado === 'completado') ? date('Y-m-d H:i:s') : null;

            $stmt = $pdo->prepare("UPDATE pedidos_etapas SET estado = ?, finalizado_en = ? WHERE id_etapa = ?");
            $stmt->execute([$nuevo_estado, $finalizado_en, $id_etapa]);

            $stmtGetVenta = $pdo->prepare("SELECT id_venta FROM pedidos_etapas WHERE id_etapa = ?");
            $stmtGetVenta->execute([$id_etapa]);
            $idVenta = $stmtGetVenta->fetch()['id_venta'];

            $stmtCount = $pdo->prepare("SELECT COUNT(*) AS pendientes FROM pedidos_etapas WHERE id_venta = ? AND estado != 'completado'");
            $stmtCount->execute([$idVenta]);
            $pendientes = intval($stmtCount->fetch()['pendientes']);

            $notificado_listo = false;
            if ($pendientes === 0) {
                $pdo->prepare("UPDATE ventas SET estado = 'listo_para_recolectar' WHERE id_venta = ?")->execute([$idVenta]);

                $stmtCli = $pdo->prepare("
                    SELECT c.nombre, c.email 
                    FROM ventas v 
                    JOIN clientes c ON v.id_cliente = c.id_cliente 
                    WHERE v.id_venta = ?
                ");
                $stmtCli->execute([$idVenta]);
                $cliInfo = $stmtCli->fetch();
                if ($cliInfo) {
                    enviarCorreoNotificacion($pdo, $idVenta, $cliInfo['email'], $cliInfo['nombre'], 'pedido_listo');
                    $notificado_listo = true;
                }
            }

            echo json_encode([
                'success' => true,
                'mensaje' => 'Subproceso actualizado con éxito.',
                'todas_completadas' => ($pendientes === 0),
                'notificado_listo' => $notificado_listo
            ]);
            break;

        case 'notificar_pedido_listo_manual':
            verificarAdmin();
            $data = json_decode(file_get_contents('php://input'), true);
            $id_venta = intval($data['id_venta'] ?? 0);

            $stmt = $pdo->prepare("
                SELECT v.id_venta, c.nombre, c.email 
                FROM ventas v 
                JOIN clientes c ON v.id_cliente = c.id_cliente 
                WHERE v.id_venta = ?
            ");
            $stmt->execute([$id_venta]);
            $row = $stmt->fetch();
            if (!$row) throw new Exception('Venta no encontrada.');

            $pdo->prepare("UPDATE ventas SET estado = 'listo_para_recolectar' WHERE id_venta = ?")->execute([$id_venta]);
            $pdo->prepare("UPDATE pedidos_etapas SET estado = 'completado', finalizado_en = NOW() WHERE id_venta = ?")->execute([$id_venta]);

            $notif = enviarCorreoNotificacion($pdo, $id_venta, $row['email'], $row['nombre'], 'pedido_listo');

            echo json_encode([
                'success' => true,
                'mensaje' => "¡Notificación enviada a {$row['email']}! El pedido #$id_venta está marcado como Listo para Recolectar.",
                'notificacion' => $notif
            ]);
            break;

        case 'get_notificaciones':
            verificarAdmin();
            $stmt = $pdo->query("
                SELECT n.*, c.nombre AS cliente_nombre 
                FROM notificaciones n
                JOIN ventas v ON n.id_venta = v.id_venta
                JOIN clientes c ON v.id_cliente = c.id_cliente
                ORDER BY n.id_notificacion DESC
                LIMIT 50
            ");
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
            break;

        // ==========================================
        // 5. REPORTES ESTADÍSTICOS (SOLO ADMIN)
        // ==========================================
        case 'reporte_venta_dia':
            verificarAdmin();
            $fecha = $_GET['fecha'] ?? date('Y-m-d');

            $stmtTotales = $pdo->prepare("
                SELECT 
                    COUNT(id_venta) AS total_pedidos,
                    COALESCE(SUM(total), 0) AS monto_total,
                    COALESCE(AVG(total), 0) AS ticket_promedio
                FROM ventas
                WHERE DATE(fecha) = ? AND estado != 'cancelado'
            ");
            $stmtTotales->execute([$fecha]);
            $totales = $stmtTotales->fetch();

            $stmtLista = $pdo->prepare("
                SELECT v.id_venta, v.fecha, c.nombre AS cliente, v.total, v.estado,
                       (SELECT COUNT(*) FROM detalle_ventas WHERE id_venta = v.id_venta) AS items
                FROM ventas v
                JOIN clientes c ON v.id_cliente = c.id_cliente
                WHERE DATE(v.fecha) = ?
                ORDER BY v.id_venta DESC
            ");
            $stmtLista->execute([$fecha]);
            $ventasDia = $stmtLista->fetchAll();

            echo json_encode([
                'success' => true,
                'fecha' => $fecha,
                'resumen' => $totales,
                'ventas' => $ventasDia
            ]);
            break;

        case 'reporte_productos_dia':
            verificarAdmin();
            $fecha = $_GET['fecha'] ?? date('Y-m-d');

            $stmt = $pdo->prepare("
                SELECT 
                    p.id_producto,
                    p.nombre,
                    p.categoria,
                    p.icon,
                    p.precio,
                    COALESCE(SUM(d.cantidad), 0) AS unidades_vendidas,
                    COALESCE(SUM(d.subtotal), 0) AS total_recaudado
                FROM productos p
                LEFT JOIN detalle_ventas d ON p.id_producto = d.id_producto
                LEFT JOIN ventas v ON d.id_venta = v.id_venta AND DATE(v.fecha) = ? AND v.estado != 'cancelado'
                GROUP BY p.id_producto
                ORDER BY total_recaudado DESC, unidades_vendidas DESC
            ");
            $stmt->execute([$fecha]);
            echo json_encode(['success' => true, 'fecha' => $fecha, 'data' => $stmt->fetchAll()]);
            break;

        case 'reporte_por_periodo':
            verificarAdmin();
            $inicio = $_GET['inicio'] ?? date('Y-m-01');
            $fin = $_GET['fin'] ?? date('Y-m-d');

            $stmtResumen = $pdo->prepare("
                SELECT 
                    COUNT(id_venta) AS total_pedidos,
                    COALESCE(SUM(total), 0) AS gran_total,
                    COALESCE(AVG(total), 0) AS promedio_ticket
                FROM ventas
                WHERE DATE(fecha) BETWEEN ? AND ? AND estado != 'cancelado'
            ");
            $stmtResumen->execute([$inicio, $fin]);
            $resumen = $stmtResumen->fetch();

            $stmtPorDia = $pdo->prepare("
                SELECT 
                    DATE(fecha) AS dia,
                    COUNT(id_venta) AS num_ventas,
                    SUM(total) AS total_dia
                FROM ventas
                WHERE DATE(fecha) BETWEEN ? AND ? AND estado != 'cancelado'
                GROUP BY DATE(fecha)
                ORDER BY dia ASC
            ");
            $stmtPorDia->execute([$inicio, $fin]);
            $porDia = $stmtPorDia->fetchAll();

            $stmtTop = $pdo->prepare("
                SELECT 
                    p.nombre, p.icon,
                    SUM(d.cantidad) AS cantidad_total,
                    SUM(d.subtotal) AS ingreso_generado
                FROM detalle_ventas d
                JOIN productos p ON d.id_producto = p.id_producto
                JOIN ventas v ON d.id_venta = v.id_venta
                WHERE DATE(v.fecha) BETWEEN ? AND ? AND v.estado != 'cancelado'
                GROUP BY p.id_producto
                ORDER BY cantidad_total DESC
                LIMIT 10
            ");
            $stmtTop->execute([$inicio, $fin]);
            $topProductos = $stmtTop->fetchAll();

            echo json_encode([
                'success' => true,
                'periodo' => ['inicio' => $inicio, 'fin' => $fin],
                'resumen' => $resumen,
                'desglose_dias' => $porDia,
                'top_productos' => $topProductos
            ]);
            break;

        // ==========================================
        // 6. VENTAS Y OPERACIÓN ESPECIAL: DEVOLUCIONES (SOLO ADMIN)
        // ==========================================
        case 'get_ventas':
            verificarAdmin();
            $query = "
                SELECT v.id_venta, v.id_cliente, c.nombre AS cliente, v.fecha, v.total, v.estado,
                       v.tiempo_estimado_min,
                       COUNT(d.id_detalle) AS total_items
                FROM ventas v
                INNER JOIN clientes c ON v.id_cliente = c.id_cliente
                LEFT JOIN detalle_ventas d ON v.id_venta = d.id_venta
                GROUP BY v.id_venta
                ORDER BY v.id_venta DESC
                LIMIT 40
            ";
            $stmt = $pdo->query($query);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
            break;

        case 'get_venta_detalle':
            verificarAdmin();
            $id_venta = intval($_GET['id_venta'] ?? 0);
            if ($id_venta <= 0) throw new Exception('ID de venta no válido.');

            $stmtVenta = $pdo->prepare("
                SELECT v.*, c.nombre AS cliente_nombre, c.email AS cliente_email 
                FROM ventas v 
                JOIN clientes c ON v.id_cliente = c.id_cliente 
                WHERE v.id_venta = ?
            ");
            $stmtVenta->execute([$id_venta]);
            $venta = $stmtVenta->fetch();
            if (!$venta) throw new Exception('Venta no encontrada.');

            $stmtDetalles = $pdo->prepare("
                SELECT d.*, p.nombre AS producto_nombre, p.icon,
                       COALESCE((
                           SELECT SUM(dev.cantidad) 
                           FROM devoluciones dev 
                           WHERE dev.id_venta = d.id_venta AND dev.id_producto = d.id_producto
                       ), 0) AS cantidad_devuelta
                FROM detalle_ventas d
                JOIN productos p ON d.id_producto = p.id_producto
                WHERE d.id_venta = ?
            ");
            $stmtDetalles->execute([$id_venta]);
            $detalles = $stmtDetalles->fetchAll();

            echo json_encode(['success' => true, 'venta' => $venta, 'detalles' => $detalles]);
            break;

        case 'procesar_devolucion':
            verificarAdmin();
            $data = json_decode(file_get_contents('php://input'), true);
            $id_venta = intval($data['id_venta'] ?? 0);
            $id_producto = intval($data['id_producto'] ?? 0);
            $cantidad = intval($data['cantidad'] ?? 0);
            $motivo = trim($data['motivo'] ?? 'Devolución de producto');
            $reintegrar_stock = isset($data['reintegrar_stock']) ? (bool)$data['reintegrar_stock'] : true;

            if ($id_venta <= 0 || $id_producto <= 0 || $cantidad <= 0) {
                throw new Exception('Parámetros de devolución no válidos.');
            }

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT cantidad, precio_unitario FROM detalle_ventas WHERE id_venta = ? AND id_producto = ?");
            $stmt->execute([$id_venta, $id_producto]);
            $detalle = $stmt->fetch();
            if (!$detalle) throw new Exception('El producto no pertenece a esta venta.');

            $stmtDev = $pdo->prepare("SELECT COALESCE(SUM(cantidad), 0) AS total_devuelto FROM devoluciones WHERE id_venta = ? AND id_producto = ?");
            $stmtDev->execute([$id_venta, $id_producto]);
            $totalDevuelto = intval($stmtDev->fetch()['total_devuelto']);

            $disponible = $detalle['cantidad'] - $totalDevuelto;
            if ($cantidad > $disponible) {
                throw new Exception("Cantidad no permitida. Solo puedes devolver hasta $disponible unidad(es).");
            }

            $monto_reembolsado = $cantidad * $detalle['precio_unitario'];

            $stmtInsert = $pdo->prepare("
                INSERT INTO devoluciones (id_venta, id_producto, cantidad, motivo, monto_reembolsado, reintegrar_stock)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmtInsert->execute([$id_venta, $id_producto, $cantidad, $motivo, $monto_reembolsado, $reintegrar_stock ? 1 : 0]);
            $id_devolucion = $pdo->lastInsertId();

            $stmtCli = $pdo->prepare("SELECT c.nombre, c.email FROM ventas v JOIN clientes c ON v.id_cliente = c.id_cliente WHERE v.id_venta = ?");
            $stmtCli->execute([$id_venta]);
            $cli = $stmtCli->fetch();
            if ($cli) {
                enviarCorreoNotificacion($pdo, $id_venta, $cli['email'], $cli['nombre'], 'devolucion');
            }

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'id_devolucion' => $id_devolucion,
                'monto_reembolsado' => $monto_reembolsado,
                'mensaje' => "Devolución #$id_devolucion aprobada ($" . number_format($monto_reembolsado, 2) . ") y stock restaurado automáticamente."
            ]);
            break;

        case 'get_devoluciones':
            verificarAdmin();
            $query = "
                SELECT d.*, p.nombre AS producto_nombre, p.icon, c.nombre AS cliente_nombre
                FROM devoluciones d
                JOIN ventas v ON d.id_venta = v.id_venta
                JOIN clientes c ON v.id_cliente = c.id_cliente
                JOIN productos p ON d.id_producto = p.id_producto
                ORDER BY d.id_devolucion DESC
                LIMIT 50
            ";
            $stmt = $pdo->query($query);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción no válida o no especificada.']);
            break;
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
