-- ========================================================
-- BASE DE DATOS: cafeteria (Versión Avanzada con Reportes, Login, Notificaciones y Procesos Hijos)
-- ========================================================
CREATE DATABASE IF NOT EXISTS cafeteria CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafeteria;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notificaciones;
DROP TABLE IF EXISTS pedidos_etapas;
DROP TABLE IF EXISTS devoluciones;
DROP TABLE IF EXISTS detalle_ventas;
DROP TABLE IF EXISTS ventas;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS productos;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. TABLA USUARIOS (Login para Administradores y Clientes)
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'cliente') NOT NULL DEFAULT 'cliente',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. TABLA CLIENTES (Vinculada opcionalmente a usuario)
CREATE TABLE clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_clientes_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. TABLA PRODUCTOS
CREATE TABLE productos (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL DEFAULT 'cafe',
    precio DECIMAL(10, 2) NOT NULL CHECK (precio >= 0),
    stock INT NOT NULL DEFAULT 50 CHECK (stock >= 0),
    icon VARCHAR(20) DEFAULT '☕',
    descripcion VARCHAR(255) DEFAULT '',
    estado ENUM('activo', 'inactivo') DEFAULT 'activo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. TABLA VENTAS / PEDIDOS PRINCIPALES (Proceso Padre)
CREATE TABLE ventas (
    id_venta INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    estado ENUM('recibido', 'en_preparacion', 'listo_para_recolectar', 'entregado', 'con_devolucion', 'cancelado') DEFAULT 'recibido',
    tiempo_estimado_min INT DEFAULT 15,
    hora_estimada_entrega DATETIME NULL,
    CONSTRAINT fk_ventas_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. TABLA DETALLE_VENTAS (Líneas de la Orden)
CREATE TABLE detalle_ventas (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    CONSTRAINT fk_detalle_venta FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. TABLA PEDIDOS_ETAPAS (Subprocesos / Procesos Hijos del Pedido)
CREATE TABLE pedidos_etapas (
    id_etapa INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    subproceso VARCHAR(80) NOT NULL, -- Ej: 'Validación de Pago', 'Molienda y Extracción', 'Cocción y Embalaje', 'Control de Calidad'
    area ENUM('Barra', 'Cocina', 'Caja', 'Entrega') NOT NULL,
    estado ENUM('pendiente', 'en_progreso', 'completado') DEFAULT 'pendiente',
    iniciado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finalizado_en DATETIME NULL,
    responsable VARCHAR(80) DEFAULT 'Barista en turno',
    CONSTRAINT fk_etapas_venta FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. TABLA DEVOLUCIONES (Operación Especial)
CREATE TABLE devoluciones (
    id_devolucion INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    motivo VARCHAR(255) NOT NULL,
    fecha_devolucion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    monto_reembolsado DECIMAL(10, 2) NOT NULL,
    reintegrar_stock BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_devoluciones_venta FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE RESTRICT,
    CONSTRAINT fk_devoluciones_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. TABLA NOTIFICACIONES (Bandeja / Bitácora de correos y avisos de recolección)
CREATE TABLE notificaciones (
    id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    destinatario VARCHAR(100) NOT NULL,
    tipo ENUM('tiempo_recoleccion', 'pedido_listo', 'devolucion') NOT NULL,
    asunto VARCHAR(150) NOT NULL,
    cuerpo TEXT NOT NULL,
    estado_envio ENUM('enviado', 'simulado', 'fallido') DEFAULT 'enviado',
    enviado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_venta FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================================
-- TRIGGERS Y AUTOMATIZACIONES
-- ========================================================

-- Trigger 1: Devolución con reintegración de inventario
DELIMITER //
CREATE TRIGGER trg_procesar_devolucion
AFTER INSERT ON devoluciones
FOR EACH ROW
BEGIN
    IF NEW.reintegrar_stock = TRUE THEN
        UPDATE productos 
        SET stock = stock + NEW.cantidad 
        WHERE id_producto = NEW.id_producto;
    END IF;

    UPDATE ventas 
    SET estado = 'con_devolucion' 
    WHERE id_venta = NEW.id_venta;
END //

-- Trigger 2: Creación automática de Procesos Hijos al confirmar una venta
CREATE TRIGGER trg_crear_subprocesos_pedido
AFTER INSERT ON ventas
FOR EACH ROW
BEGIN
    -- Subproceso 1: Validación y Apertura de Ticket
    INSERT INTO pedidos_etapas (id_venta, subproceso, area, estado, responsable)
    VALUES (NEW.id_venta, 'Validación de Ticket y Pago', 'Caja', 'completado', 'Cajero en turno');

    -- Subproceso 2: Preparación de Bebidas (Barista)
    INSERT INTO pedidos_etapas (id_venta, subproceso, area, estado, responsable)
    VALUES (NEW.id_venta, 'Preparación en Barra de Café', 'Barra', 'en_progreso', 'Barista');

    -- Subproceso 3: Embalaje / Calentamiento de Alimentos
    INSERT INTO pedidos_etapas (id_venta, subproceso, area, estado, responsable)
    VALUES (NEW.id_venta, 'Calentamiento y Empaque de Alimentos', 'Cocina', 'pendiente', 'Auxiliar de Cocina');

    -- Subproceso 4: Entrega en Mostrador y Notificación
    INSERT INTO pedidos_etapas (id_venta, subproceso, area, estado, responsable)
    VALUES (NEW.id_venta, 'Entrega en Mostrador y Llamado', 'Entrega', 'pendiente', 'Host / Mostrador');
END //
DELIMITER ;

-- ========================================================
-- SEMILLAS INICIALES (DATOS DE PRUEBA)
-- ========================================================

-- Usuarios: 
-- admin@cafeconleche.com (pass: admin123)
-- cliente@cafeconleche.com (pass: cliente123)
-- Hash estándar sha256 o password_verify. Por portabilidad local usaremos sha256 y texto seguro.
INSERT INTO usuarios (nombre, email, password, rol) VALUES
('Administrador POS', 'admin@cafeconleche.com', SHA2('admin123', 256), 'admin'),
('Valeria Morales', 'valeria@example.com', SHA2('cliente123', 256), 'cliente'),
('Carlos Mendoza', 'carlos.m@example.com', SHA2('cliente123', 256), 'cliente'),
('Cliente General', 'general@cafeconleche.com', SHA2('cliente123', 256), 'cliente');

INSERT INTO clientes (id_usuario, nombre, email, telefono) VALUES
(4, 'Cliente General', 'general@cafeconleche.com', '2221234567'),
(2, 'Valeria Morales', 'valeria@example.com', '2229876543'),
(3, 'Carlos Mendoza', 'carlos.m@example.com', '2224567890');

INSERT INTO productos (id_producto, nombre, categoria, precio, stock, icon, descripcion) VALUES
(1, 'Café americano', 'cafe', 38.00, 100, '☕', 'Café intenso y aromático, recién preparado.'),
(2, 'Café con leche', 'cafe', 48.00, 80, '🥛', 'Espresso suave con leche cremosa.'),
(3, 'Cappuccino', 'cafe', 55.00, 75, '☕', 'Espresso, leche vaporizada y espuma.'),
(4, 'Chocolate caliente', 'cafe', 52.00, 60, '🍫', 'Chocolate caliente, cremoso y reconfortante.'),
(5, 'Frappé de café', 'fria', 68.00, 50, '🧋', 'Café frío, hielo y crema.'),
(6, 'Té helado', 'fria', 45.00, 90, '🍹', 'Té refrescante con hielo y limón.'),
(7, 'Limonada', 'fria', 42.00, 100, '🍋', 'Limón natural, agua y un toque dulce.'),
(8, 'Smoothie frutos rojos', 'fria', 70.00, 45, '🍓', 'Mezcla cremosa de frutos rojos.'),
(9, 'Chilaquiles', 'comida', 85.00, 40, '🍳', 'Totopos, salsa, crema, queso y huevo.'),
(10, 'Sándwich de pollo', 'comida', 78.00, 35, '🥪', 'Pan artesanal, pollo y vegetales frescos.'),
(11, 'Croissant', 'comida', 48.00, 50, '🥐', 'Hojaldre dorado, ligero y crujiente.'),
(12, 'Hot cakes', 'comida', 72.00, 30, '🥞', 'Hot cakes esponjosos con fruta fresca.'),
(13, 'Cheesecake', 'postre', 65.00, 25, '🍰', 'Rebanada cremosa con base crujiente.'),
(14, 'Brownie', 'postre', 52.00, 40, '🍫', 'Brownie de chocolate suave y tibio.'),
(15, 'Galleta con chispas', 'postre', 35.00, 60, '🍪', 'Galleta horneada con chispas de chocolate.'),
(16, 'Pan de plátano', 'postre', 48.00, 35, '🍌', 'Pan casero de plátano suave y aromático.');

-- Semillas de ventas pasadas y de hoy para que los reportes muestren datos de inmediato:
INSERT INTO ventas (id_cliente, fecha, total, estado, tiempo_estimado_min, hora_estimada_entrega) VALUES
(2, NOW() - INTERVAL 2 DAY, 133.00, 'entregado', 15, NOW() - INTERVAL 2 DAY + INTERVAL 15 MINUTE),
(3, NOW() - INTERVAL 1 DAY, 150.00, 'entregado', 20, NOW() - INTERVAL 1 DAY + INTERVAL 20 MINUTE),
(2, NOW() - INTERVAL 2 HOUR, 96.00, 'listo_para_recolectar', 15, NOW() - INTERVAL 2 HOUR + INTERVAL 15 MINUTE),
(3, NOW() - INTERVAL 30 MINUTE, 123.00, 'en_preparacion', 25, NOW() + INTERVAL 5 MINUTE);

INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario) VALUES
(1, 1, 1, 38.00), (1, 9, 1, 85.00), (1, 11, 1, 10.00),
(2, 3, 2, 55.00), (2, 14, 1, 40.00),
(3, 2, 2, 48.00),
(4, 5, 1, 68.00), (4, 3, 1, 55.00);

-- Subprocesos para las ventas iniciales
INSERT INTO pedidos_etapas (id_venta, subproceso, area, estado, responsable) VALUES
(3, 'Validación de Ticket y Pago', 'Caja', 'completado', 'Caja 1'),
(3, 'Preparación en Barra de Café', 'Barra', 'completado', 'Barista 1'),
(3, 'Calentamiento y Empaque de Alimentos', 'Cocina', 'completado', 'Cocina 1'),
(3, 'Entrega en Mostrador y Llamado', 'Entrega', 'en_progreso', 'Host');
