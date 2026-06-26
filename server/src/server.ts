import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, initDb } from './db.js';

const app = express();
// Mock Socket.io for Vercel Serverless compatibility
const io = {
  emit: (...args: any[]) => {}
};

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'carniqr_super_secret_key_12345';

// WebSocket connection handling
// Broadcast queue update mock (realtime handled by Supabase)
function broadcastQueueUpdate() {
  // io.emit('queue-updated');
}

// Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
  };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user as AuthenticatedRequest['user'];
    next();
  });
}

function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado: permisos insuficientes' });
    }
    next();
  };
}

// ROUTES

// 1. Authentication
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await db('usuarios').where({ email }).first();
    if (!user) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Client Turns API
app.post('/api/turnos/obtener', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().split(' ')[0];

    // Get last number for today
    const lastTurn = await db('turnos')
      .where({ fecha: today })
      .orderBy('numero', 'desc')
      .first();

    const nextNumber = lastTurn ? lastTurn.numero + 1 : 1;
    const turnId = crypto.randomUUID();
    const clientId = crypto.randomUUID();

    // Estimate wait time based on waiting turns ahead * 5 minutes
    const waitingAhead = await db('turnos')
      .where({ fecha: today, estado: 'Esperando' })
      .count({ count: '*' })
      .first();

    const turnsCount = waitingAhead ? Number(waitingAhead.count) : 0;
    const tiempoEstimado = Math.max(5, turnsCount * 5); // minimum 5 mins

    const newTurn = {
      id: turnId,
      numero: nextNumber,
      estado: 'Esperando',
      fecha: today,
      hora: nowTime,
      cliente_id: clientId,
      tiempo_estimado: tiempoEstimado,
    };

    await db('turnos').insert(newTurn);
    broadcastQueueUpdate();

    res.status(201).json(newTurn);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get state of the queue
app.get('/api/turnos/estado', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Current called turn
    const turnoLlamado = await db('turnos')
      .where({ fecha: today, estado: 'Llamado' })
      .orderBy('numero', 'desc') // in case multiple are called, get the latest
      .first();

    // Default to last attended if no called turn
    let turnoLlamadoNum = turnoLlamado ? turnoLlamado.numero : 0;
    if (!turnoLlamado) {
      const ultimoAtendido = await db('turnos')
        .where({ fecha: today, estado: 'Atendido' })
        .orderBy('numero', 'desc')
        .first();
      turnoLlamadoNum = ultimoAtendido ? ultimoAtendido.numero : 0;
    }

    // Total waiting
    const waitingCountRes = await db('turnos')
      .where({ fecha: today, estado: 'Esperando' })
      .count({ count: '*' })
      .first();
    const waitingCount = waitingCountRes ? Number(waitingCountRes.count) : 0;

    res.json({
      turnoLlamado: turnoLlamadoNum,
      esperando: waitingCount,
      turnoIdLlamado: turnoLlamado ? turnoLlamado.id : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get detail of a specific turn
app.get('/api/turnos/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const turn = await db('turnos').where({ id }).first();
    if (!turn) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Count turns ahead of this one
    let personasDelante = 0;
    if (turn.estado === 'Esperando') {
      const aheadRes = await db('turnos')
        .where({ fecha: today, estado: 'Esperando' })
        .andWhere('numero', '<', turn.numero)
        .count({ count: '*' })
        .first();
      personasDelante = aheadRes ? Number(aheadRes.count) : 0;
    }

    // Update estimated wait time dynamically
    const tiempoEstimado = personasDelante * 5;

    res.json({
      ...turn,
      personasDelante,
      tiempoEstimado: Math.max(5, tiempoEstimado),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all turns (for Employee control panel)
app.get('/api/empleado/turnos', authenticateToken, requireRole(['empleado', 'admin']), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const turnos = await db('turnos')
      .where({ fecha: today })
      .orderBy('numero', 'asc');
    res.json(turnos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Call next turn (Employee operation)
app.post('/api/empleado/llamar-siguiente', authenticateToken, requireRole(['empleado', 'admin']), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Move any currently 'Llamado' turns to 'Atendido' or leave as is?
    // Usually, we set previous 'Llamado' turns to 'Atendido' to proceed.
    await db('turnos')
      .where({ fecha: today, estado: 'Llamado' })
      .update({ estado: 'Atendido' });

    // Find next 'Esperando' turn
    const nextTurn = await db('turnos')
      .where({ fecha: today, estado: 'Esperando' })
      .orderBy('numero', 'asc')
      .first();

    if (!nextTurn) {
      broadcastQueueUpdate();
      return res.status(404).json({ message: 'No hay más turnos en espera' });
    }

    await db('turnos')
      .where({ id: nextTurn.id })
      .update({ estado: 'Llamado' });

    // Emit event with the specific ticket details called
    io.emit('turn-called', {
      id: nextTurn.id,
      numero: nextTurn.numero,
    });

    broadcastQueueUpdate();

    res.json({ message: 'Turno llamado correctamente', turno: nextTurn });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update specific turn status
app.put('/api/empleado/turnos/:id/estado', authenticateToken, requireRole(['empleado', 'admin']), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { estado } = req.body; // Esperando, Llamado, Atendido, Ausente
  try {
    const turn = await db('turnos').where({ id }).first();
    if (!turn) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    await db('turnos').where({ id }).update({ estado });

    if (estado === 'Llamado') {
      io.emit('turn-called', {
        id: turn.id,
        numero: turn.numero,
      });
    }

    broadcastQueueUpdate();
    res.json({ message: 'Estado del turno actualizado', turno: { ...turn, estado } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Products & Categories API
app.get('/api/categorias', async (req: Request, res: Response) => {
  try {
    const categories = await db('categorias').select('*');
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/productos', async (req: Request, res: Response) => {
  try {
    const products = await db('productos')
      .where({ activo: true })
      .select('*');
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/promociones', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const promos = await db('promociones')
      .where({ activa: true })
      .andWhere('fecha_inicio', '<=', today)
      .andWhere('fecha_fin', '>=', today)
      .select('*');
    res.json(promos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Pre-Order (Pedidos) API
app.post('/api/pedidos', async (req: Request, res: Response) => {
  const { turno_id, items } = req.body; // items: [{ producto_id, cantidad, precio }]
  try {
    const orderId = crypto.randomUUID();

    await db.transaction(async (trx) => {
      await trx('pedidos').insert({
        id: orderId,
        turno_id,
        estado: 'Pendiente',
        fecha: new Date().toISOString(),
      });

      const orderItems = items.map((item: any) => ({
        id: crypto.randomUUID(),
        pedido_id: orderId,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio: item.precio,
      }));

      await trx('pedido_items').insert(orderItems);
    });

    io.emit('order-created', { orderId, turno_id });
    res.status(201).json({ id: orderId, message: 'Pedido creado exitosamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pedidos/turno/:turnoId', async (req: Request, res: Response) => {
  const { turnoId } = req.params;
  try {
    const order = await db('pedidos').where({ turno_id: turnoId }).first();
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado para este turno' });
    }

    const items = await db('pedido_items')
      .where({ pedido_id: order.id })
      .leftJoin('productos', 'pedido_items.producto_id', '=', 'productos.id')
      .leftJoin('promociones', 'pedido_items.producto_id', '=', 'promociones.id')
      .select(
        'pedido_items.*',
        db.raw('COALESCE(productos.nombre, promociones.titulo) as producto_nombre')
      );

    res.json({ ...order, items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all orders (for Employee & Admin)
app.get('/api/empleado/pedidos', authenticateToken, requireRole(['empleado', 'admin']), async (req: Request, res: Response) => {
  try {
    const orders = await db('pedidos')
      .join('turnos', 'pedidos.turno_id', '=', 'turnos.id')
      .select('pedidos.*', 'turnos.numero as turno_numero')
      .orderBy('pedidos.fecha', 'desc');

    const result = [];
    for (const order of orders) {
      const items = await db('pedido_items')
        .where({ pedido_id: order.id })
        .leftJoin('productos', 'pedido_items.producto_id', '=', 'productos.id')
        .leftJoin('promociones', 'pedido_items.producto_id', '=', 'promociones.id')
        .select(
          'pedido_items.*',
          db.raw('COALESCE(productos.nombre, promociones.titulo) as producto_nombre')
        );
      result.push({ ...order, items });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/empleado/pedidos/:id/estado', authenticateToken, requireRole(['empleado', 'admin']), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { estado } = req.body; // Pendiente, Preparando, Listo, Entregado
  try {
    await db('pedidos').where({ id }).update({ estado });
    res.json({ message: 'Estado del pedido actualizado', id, estado });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Admin Panel Endpoints (CRUD + Stats)

// Products CRUD
app.post('/api/admin/productos', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { nombre, descripcion, precio, imagen, categoria_id, activo } = req.body;
  try {
    const id = crypto.randomUUID();
    const product = { id, nombre, descripcion, precio, imagen, categoria_id, activo: activo ?? true };
    await db('productos').insert(product);
    res.status(201).json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/productos/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, descripcion, precio, imagen, categoria_id, activo } = req.body;
  try {
    await db('productos')
      .where({ id })
      .update({ nombre, descripcion, precio, imagen, categoria_id, activo });
    res.json({ message: 'Producto modificado exitosamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/productos/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db('productos').where({ id }).delete();
    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Promotions CRUD
app.post('/api/admin/promociones', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { titulo, descripcion, precio, imagen, fecha_inicio, fecha_fin, activa } = req.body;
  try {
    const id = crypto.randomUUID();
    const promo = { id, titulo, descripcion, precio, imagen, fecha_inicio, fecha_fin, activa: activa ?? true };
    await db('promociones').insert(promo);
    res.status(201).json(promo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/promociones/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { titulo, descripcion, precio, imagen, fecha_inicio, fecha_fin, activa } = req.body;
  try {
    await db('promociones')
      .where({ id })
      .update({ titulo, descripcion, precio, imagen, fecha_inicio, fecha_fin, activa });
    res.json({ message: 'Promoción modificada exitosamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/promociones/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db('promociones').where({ id }).delete();
    res.json({ message: 'Promoción eliminada exitosamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Stats
app.get('/api/admin/stats', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const turnosEmitidos = await db('turnos').count({ count: '*' }).first();
    const clientesAtendidos = await db('turnos')
      .where({ estado: 'Atendido' })
      .count({ count: '*' })
      .first();

    const totalOrders = await db('pedidos').count({ count: '*' }).first();

    // Mock/Dummy calculation for demo statistics
    res.json({
      turnosEmitidos: turnosEmitidos ? Number(turnosEmitidos.count) : 0,
      clientesAtendidos: clientesAtendidos ? Number(clientesAtendidos.count) : 0,
      pedidosRealizados: totalOrders ? Number(totalOrders.count) : 0,
      tiempoPromedioEspera: 12, // Dummy static value for MVP
      productosPopulares: [
        { nombre: 'Asado de Tira', consultas: 45 },
        { nombre: 'Bife de Chorizo', consultas: 32 },
        { nombre: 'Chorizo Bombón', consultas: 28 },
      ],
      promocionesPopulares: [
        { titulo: 'Mega Combo Parrilla', vistas: 89 },
        { titulo: 'Miércoles de Pollo', vistas: 41 },
      ],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;

// Start Server and Init Database (only when running locally outside Vercel)
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  }).catch((err) => {
    console.error('Failed to initialize database:', err);
  });
}
