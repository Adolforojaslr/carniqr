# PROYECTO: CARNIQR

## Documento Funcional (PRD)

**Versión:** 1.0
**Estado:** MVP
**Fecha:** Junio 2026

---

# 1. RESUMEN EJECUTIVO

CarniQR es una aplicación web responsive diseñada para carnicerías y comercios minoristas que permite gestionar turnos mediante códigos QR, optimizar la atención al cliente y aumentar las ventas durante el tiempo de espera mediante promociones, ofertas y pedidos anticipados.

El sistema elimina las filas físicas y mejora la experiencia de compra mediante una plataforma digital accesible desde cualquier teléfono móvil sin necesidad de instalar aplicaciones.

---

# 2. OBJETIVOS DEL PROYECTO

## Objetivos Operativos

* Eliminar filas físicas.
* Organizar la atención al público.
* Reducir tiempos de espera percibidos.
* Mejorar la experiencia del cliente.

## Objetivos Comerciales

* Incrementar ventas por impulso.
* Mostrar promociones durante la espera.
* Impulsar productos destacados.
* Facilitar la venta cruzada.

## Objetivos Estratégicos

* Digitalizar la atención.
* Generar una base de clientes.
* Crear una plataforma escalable para múltiples comercios.

---

# 3. TIPOS DE USUARIO

## Cliente

Persona que visita el comercio.

### Puede:

* Escanear QR.
* Obtener turno.
* Consultar estado de espera.
* Ver promociones.
* Ver catálogo.
* Crear pedido anticipado.

---

## Empleado

Personal de atención.

### Puede:

* Llamar siguiente turno.
* Repetir turno.
* Saltar turno.
* Finalizar atención.

---

## Administrador

Propietario o gerente.

### Puede:

* Gestionar productos.
* Gestionar promociones.
* Ver estadísticas.
* Gestionar usuarios.

---

# 4. FLUJO GENERAL DEL SISTEMA

## Paso 1

Cliente llega al local.

## Paso 2

Escanea código QR.

## Paso 3

Sistema genera automáticamente:

* Número de turno.
* Fecha.
* Hora.
* Estado.

## Paso 4

Cliente visualiza:

* Su turno.
* Turno actual.
* Personas delante.
* Tiempo estimado.

## Paso 5

Mientras espera puede:

* Ver promociones.
* Consultar productos.
* Crear pedido anticipado.

## Paso 6

Empleado llama siguiente turno.

## Paso 7

Sistema actualiza automáticamente todas las pantallas.

---

# 5. FUNCIONALIDADES MVP

## 5.1 Turnero Digital

### Objetivo

Asignar turnos automáticamente.

### Requisitos

* Numeración secuencial.
* Actualización en tiempo real.
* Persistencia en base de datos.
* Consulta desde dispositivos móviles.

### Estados

* Esperando
* Llamado
* Atendido
* Ausente

---

## 5.2 Pantalla Cliente

### Información mostrada

* Número de turno.
* Turno actual.
* Personas delante.
* Tiempo estimado.
* Promociones activas.

### Actualización

Automática sin recargar página.

---

## 5.3 Gestión de Turnos

### Panel Empleado

Acciones disponibles:

* Siguiente Turno
* Repetir Turno
* Saltar Turno
* Finalizar Atención

---

## 5.4 Promociones

### Datos

* Título
* Descripción
* Precio
* Imagen
* Fecha Inicio
* Fecha Fin
* Estado

### Visualización

Mostrar automáticamente promociones activas.

---

## 5.5 Catálogo de Productos

### Categorías

* Vacuno
* Cerdo
* Pollo
* Embutidos
* Congelados

### Información

* Nombre
* Imagen
* Precio
* Categoría
* Disponibilidad

---

## 5.6 Pedido Anticipado

### Objetivo

Permitir que el cliente prepare su pedido mientras espera.

### Flujo

1. Seleccionar productos.
2. Indicar cantidad.
3. Confirmar pedido.
4. Asociar pedido al turno.

---

## 5.7 Dashboard

### Métricas

* Turnos emitidos.
* Clientes atendidos.
* Tiempo promedio de espera.
* Productos más consultados.
* Promociones más vistas.

---

# 6. PANTALLAS DEL SISTEMA

## Cliente

### Pantalla Inicio

* Bienvenida.
* Botón Obtener Turno.

### Pantalla Turno

* Número de turno.
* Estado de cola.

### Pantalla Promociones

* Ofertas activas.

### Pantalla Catálogo

* Productos disponibles.

### Pantalla Pedido

* Selección de productos.

---

## Empleado

### Login

Autenticación segura.

### Panel de Atención

* Turno actual.
* Próximo turno.
* Acciones rápidas.

### Historial

Listado de turnos atendidos.

---

## Administrador

### Dashboard

Indicadores generales.

### Productos

ABM completo.

### Promociones

ABM completo.

### Usuarios

ABM completo.

### Configuración

Parámetros generales.

---

# 7. DISEÑO UX/UI

## Estilo Visual

* Moderno.
* Profesional.
* Minimalista.
* Comercial.

## Colores

### Primarios

* Rojo oscuro.
* Negro.

### Secundarios

* Blanco.
* Gris claro.

## Prioridad

Diseño Mobile First.

---

# 8. ARQUITECTURA TÉCNICA

## Frontend

* React
* TypeScript
* Tailwind CSS

## Backend

* Node.js
* Express

## Base de Datos

* PostgreSQL

## Comunicación Tiempo Real

* WebSockets

## Autenticación

* JWT

---

# 9. MODELO DE DATOS

## Tabla usuarios

| Campo          | Tipo      |
| -------------- | --------- |
| id             | UUID      |
| nombre         | VARCHAR   |
| email          | VARCHAR   |
| password       | VARCHAR   |
| rol            | VARCHAR   |
| fecha_creacion | TIMESTAMP |

---

## Tabla turnos

| Campo           | Tipo    |
| --------------- | ------- |
| id              | UUID    |
| numero          | INTEGER |
| estado          | VARCHAR |
| fecha           | DATE    |
| hora            | TIME    |
| cliente_id      | UUID    |
| tiempo_estimado | INTEGER |

---

## Tabla promociones

| Campo        | Tipo    |
| ------------ | ------- |
| id           | UUID    |
| titulo       | VARCHAR |
| descripcion  | TEXT    |
| precio       | DECIMAL |
| imagen       | VARCHAR |
| fecha_inicio | DATE    |
| fecha_fin    | DATE    |
| activa       | BOOLEAN |

---

## Tabla categorias

| Campo  | Tipo    |
| ------ | ------- |
| id     | UUID    |
| nombre | VARCHAR |

---

## Tabla productos

| Campo        | Tipo    |
| ------------ | ------- |
| id           | UUID    |
| nombre       | VARCHAR |
| descripcion  | TEXT    |
| precio       | DECIMAL |
| imagen       | VARCHAR |
| categoria_id | UUID    |
| activo       | BOOLEAN |

---

## Tabla pedidos

| Campo    | Tipo      |
| -------- | --------- |
| id       | UUID      |
| turno_id | UUID      |
| estado   | VARCHAR   |
| fecha    | TIMESTAMP |

---

## Tabla pedido_items

| Campo       | Tipo    |
| ----------- | ------- |
| id          | UUID    |
| pedido_id   | UUID    |
| producto_id | UUID    |
| cantidad    | INTEGER |
| precio      | DECIMAL |

---

# 10. REQUISITOS NO FUNCIONALES

## Rendimiento

* Tiempo de carga menor a 2 segundos.

## Seguridad

* Autenticación JWT.
* Validación de datos.
* Protección contra acceso no autorizado.

## Escalabilidad

Preparado para:

* Multi sucursal.
* Multi comercio.
* SaaS futuro.

## Compatibilidad

* Android
* iPhone
* Tablet
* Desktop

---

# 11. ROADMAP

## Fase 1 - MVP

* QR
* Turnos
* Promociones
* Catálogo
* Dashboard básico

## Fase 2

* WhatsApp
* Notificaciones
* Cupones

## Fase 3

* Programa de puntos
* Fidelización

## Fase 4

* Multi comercio
* SaaS
* Inteligencia Artificial

---

# 12. CRITERIOS DE ÉXITO

El sistema será considerado exitoso cuando:

* Los clientes obtengan turnos desde QR.
* Los empleados gestionen la cola digitalmente.
* Las promociones sean visibles durante la espera.
* El administrador pueda gestionar el negocio desde el panel.
* El sistema funcione correctamente desde cualquier dispositivo móvil.

---

# FIN DEL DOCUMENTO
