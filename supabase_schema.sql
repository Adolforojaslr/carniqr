-- 1. Crear tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(255) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL, -- admin, empleado
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear tabla de Turnos
CREATE TABLE IF NOT EXISTS turnos (
    id VARCHAR(255) PRIMARY KEY,
    numero INTEGER NOT NULL,
    estado VARCHAR(50) NOT NULL, -- Esperando, Llamado, Atendido, Ausente
    fecha VARCHAR(50) NOT NULL, -- YYYY-MM-DD
    hora VARCHAR(50) NOT NULL, -- HH:MM:SS
    cliente_id VARCHAR(255) NOT NULL,
    cliente_nombre VARCHAR(255) DEFAULT '',
    tiempo_estimado INTEGER DEFAULT 10
);

-- 3. Crear tabla de Promociones
CREATE TABLE IF NOT EXISTS promociones (
    id VARCHAR(255) PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    imagen VARCHAR(255),
    fecha_inicio VARCHAR(50) NOT NULL,
    fecha_fin VARCHAR(50) NOT NULL,
    activa BOOLEAN DEFAULT TRUE
);

-- 4. Crear tabla de Categorias
CREATE TABLE IF NOT EXISTS categorias (
    id VARCHAR(255) PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE NOT NULL
);

-- 5. Crear tabla de Productos
CREATE TABLE IF NOT EXISTS productos (
    id VARCHAR(255) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL,
    imagen VARCHAR(255),
    categoria_id VARCHAR(255) REFERENCES categorias(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE
);

-- 6. Crear tabla de Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id VARCHAR(255) PRIMARY KEY,
    turno_id VARCHAR(255) REFERENCES turnos(id) ON DELETE CASCADE,
    estado VARCHAR(50) NOT NULL, -- Pendiente, Preparando, Listo, Entregado
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Crear tabla de Pedido Items
CREATE TABLE IF NOT EXISTS pedido_items (
    id VARCHAR(255) PRIMARY KEY,
    pedido_id VARCHAR(255) REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id VARCHAR(255), -- Puede referenciar producto o promocion (se maneja a nivel de aplicacion)
    cantidad INTEGER NOT NULL,
    precio DECIMAL(10, 2) NOT NULL
);

-- =========================================================================
-- SEED DATA (Datos iniciales)
-- =========================================================================

-- Inserción de usuarios iniciales (Contraseñas encriptadas con bcrypt, equivalentes a 'admin123' y 'empleado123')
INSERT INTO usuarios (id, nombre, email, password, rol)
VALUES 
('user-admin', 'Admin CarniQR', 'admin@carniqr.com', '$2a$10$3a31GumCMZzUSuFVIi7.0u6Azr4I0mG8QvjHNjF8NAb7BnX7EI6wO', 'admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, nombre, email, password, rol)
VALUES 
('user-employee', 'Juan Pérez', 'empleado@carniqr.com', '$2a$10$/c1gIdeU6gPSMUCXFFqjA.u/xAjV4hvB7Py3vZUIruv/GCnPWXkzy', 'empleado')
ON CONFLICT (id) DO NOTHING;

-- Inserción de categorías
INSERT INTO categorias (id, nombre) VALUES
('cat-vacuno', 'Vacuno'),
('cat-cerdo', 'Cerdo'),
('cat-pollo', 'Pollo'),
('cat-embutidos', 'Embutidos'),
('cat-congelados', 'Congelados')
ON CONFLICT (id) DO NOTHING;

-- Inserción de productos iniciales
INSERT INTO productos (id, nombre, descripcion, precio, imagen, categoria_id, activo) VALUES
('prod-1', 'Asado de Tira', 'Corte clásico argentino, ideal para parrilla', 8500.00, 'asado_tira.jpg', 'cat-vacuno', TRUE),
('prod-2', 'Bife de Chorizo', 'Corte tierno y jugoso con cobertura de grasa tierna', 9800.00, 'bife_chorizo.jpg', 'cat-vacuno', TRUE),
('prod-3', 'Pechuga de Pollo', 'Supremas frescas sin piel', 4500.00, 'pechuga_pollo.jpg', 'cat-pollo', TRUE),
('prod-4', 'Costillita de Cerdo', 'Costillas de cerdo seleccionadas, tiernas y sabrosas', 5800.00, 'costillita_cerdo.jpg', 'cat-cerdo', TRUE),
('prod-5', 'Chorizo Bombón', 'Chorizo puro de cerdo, pack por 6 unidades', 3500.00, 'chorizo_bombon.jpg', 'cat-embutidos', TRUE),
('prod-6', 'Hamburguesas de Vacuno', 'Medallones de carne 100% vacuna, pack de 4 unidades', 2900.00, 'hamburguesas.jpg', 'cat-congelados', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Inserción de promociones iniciales (Válidas para los próximos 30 días)
INSERT INTO promociones (id, titulo, descripcion, precio, imagen, fecha_inicio, fecha_fin, activa) VALUES
('promo-1', 'Mega Combo Parrilla', '2 kg de Asado de Tira + 1 kg de Vacío + 6 Chorizos', 22000.00, 'combo_parrilla.jpg', TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE + 30, 'YYYY-MM-DD'), TRUE),
('promo-2', 'Miércoles de Pollo', '3 kg de Pata y Muslo a un precio increíble', 7500.00, 'promo_pollo.jpg', TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE + 30, 'YYYY-MM-DD'), TRUE)
ON CONFLICT (id) DO NOTHING;
