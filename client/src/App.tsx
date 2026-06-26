import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  ShoppingBag, 
  Percent, 
  Play, 
  CheckCircle, 
  Plus, 
  Trash2, 
  LogOut, 
  Maximize,
  UtensilsCrossed,
  XCircle,
  Pencil,
  QrCode
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const SERVER_HOST = window.location.hostname;
const API_BASE = SERVER_HOST === 'localhost' || SERVER_HOST.includes('192.168.')
  ? `http://${SERVER_HOST}:5000/api`
  : '/api';

// Initialize Supabase Client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simple helper to format currency
const formatPrice = (val: number | string) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(Number(val));
};

export default function App() {
  // Navigation / Routing state
  const [currentPath, setCurrentPath] = useState<string>(''); // '', 'turno', 'login', 'empleado', 'admin'
  const [activeTurnId, setActiveTurnId] = useState<string | null>(localStorage.getItem('carniqr_turn_id'));
  
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('carniqr_token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('carniqr_user') || 'null'));

  // Main UI Data states
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Real-time Turn status (Client side)
  const [myTurn, setMyTurn] = useState<any>(null);
  const [queueState, setQueueState] = useState({
    turnoLlamado: 0,
    esperando: 0,
    turnoIdLlamado: null
  });

  // Pre-order / Cart state
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [myOrder, setMyOrder] = useState<any>(null);

  // Employee Queue management states
  const [employeeTurns, setEmployeeTurns] = useState<any[]>([]);
  const [employeeOrders, setEmployeeOrders] = useState<any[]>([]);

  // Admin states
  const [adminStats, setAdminStats] = useState<any>(null);
  const [crudMode, setCrudMode] = useState<'productos' | 'promociones'>('productos');
  const [newProduct, setNewProduct] = useState({
    nombre: '', descripcion: '', precio: '', imagen: '', categoria_id: '', activo: true
  });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newPromo, setNewPromo] = useState({
    titulo: '', descripcion: '', precio: '', imagen: '', fecha_inicio: '', fecha_fin: '', activa: true
  });
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Login form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Handle simple routing via Hash/State
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      const parts = hash.split('/');
      if (parts[0] === 'turno' && parts[1]) {
        setActiveTurnId(parts[1]);
        localStorage.setItem('carniqr_turn_id', parts[1]);
        setCurrentPath('turno');
      } else if (hash === 'empleado') {
        setCurrentPath('empleado');
      } else if (hash === 'admin') {
        setCurrentPath('admin');
      } else if (hash === 'login') {
        setCurrentPath('login');
      } else {
        setCurrentPath('');
      }
    };

    window.addEventListener('hashchange', handleHash);
    handleHash();

    // Fetch initial static catalog data
    fetchData();

    // Setup Supabase Realtime channel subscriptions
    const turnosChannel = supabase
      .channel('public:turnos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos' },
        (payload: any) => {
          console.log('Realtime turn update:', payload);
          fetchQueueStatus();
          
          if (window.location.hash.replace('#', '') === 'empleado') {
            fetchEmployeeData();
          }

          if (payload.new && payload.new.estado === 'Llamado') {
            const mySavedTurn = localStorage.getItem('carniqr_turn_num');
            if (mySavedTurn && parseInt(mySavedTurn) === payload.new.numero) {
              if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200, 100, 200]);
              }
              try {
                const speak = new SpeechSynthesisUtterance(`Turno número ${payload.new.numero}, por favor acercarse a la caja.`);
                speak.lang = 'es-ES';
                window.speechSynthesis.speak(speak);
              } catch(e) {}
              alert(`¡TU TURNO ${payload.new.numero} HA SIDO LLAMADO!`);
            }
          }
        }
      )
      .subscribe();

    const pedidosChannel = supabase
      .channel('public:pedidos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          if (window.location.hash.replace('#', '') === 'empleado') {
            fetchEmployeeData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(turnosChannel);
      supabase.removeChannel(pedidosChannel);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  useEffect(() => {
    if (currentPath === 'turno' && activeTurnId) {
      fetchMyTurnDetails();
      fetchMyOrderDetails();
    }
    if (currentPath === 'empleado' && token) {
      fetchEmployeeData();
    }
    if (currentPath === 'admin' && token) {
      fetchAdminStats();
    }
  }, [currentPath, activeTurnId, token]);

  const fetchData = async () => {
    try {
      const [catsRes, prodsRes, promosRes] = await Promise.all([
        fetch(`${API_BASE}/categorias`),
        fetch(`${API_BASE}/productos`),
        fetch(`${API_BASE}/promociones`)
      ]);
      const cats = await catsRes.json();
      const prods = await prodsRes.json();
      const promos = await promosRes.json();

      setCategories(cats);
      setProducts(prods);
      setPromotions(promos);
      if (cats.length > 0) {
        setNewProduct(prev => ({ ...prev, categoria_id: cats[0].id }));
      }
      fetchQueueStatus();
    } catch (e) {
      console.error('Error fetching data:', e);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/turnos/estado`);
      const data = await res.json();
      setQueueState(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMyTurnDetails = async () => {
    if (!activeTurnId) return;
    try {
      const res = await fetch(`${API_BASE}/turnos/${activeTurnId}`);
      if (res.ok) {
        const data = await res.json();
        setMyTurn(data);
        localStorage.setItem('carniqr_turn_num', String(data.numero));
      } else {
        // Clear invalid turn
        setActiveTurnId(null);
        localStorage.removeItem('carniqr_turn_id');
        localStorage.removeItem('carniqr_turn_num');
        window.location.hash = '';
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMyOrderDetails = async () => {
    if (!activeTurnId) return;
    try {
      const res = await fetch(`${API_BASE}/pedidos/turno/${activeTurnId}`);
      if (res.ok) {
        const data = await res.json();
        setMyOrder(data);
      } else {
        setMyOrder(null);
      }
    } catch (e) {
      setMyOrder(null);
    }
  };

  const fetchEmployeeData = async () => {
    try {
      const [turnsRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/empleado/turnos`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/empleado/pedidos`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (turnsRes.ok && ordersRes.ok) {
        setEmployeeTurns(await turnsRes.json());
        setEmployeeOrders(await ordersRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setAdminStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Turn management actions
  const handleGetTurn = async () => {
    try {
      const res = await fetch(`${API_BASE}/turnos/obtener`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setActiveTurnId(data.id);
      localStorage.setItem('carniqr_turn_id', data.id);
      localStorage.setItem('carniqr_turn_num', String(data.numero));
      window.location.hash = `turno/${data.id}`;
    } catch (e) {
      alert('Error al solicitar turno');
    }
  };

  const handleCancelTurn = () => {
    if (confirm('¿Seguro que deseas cancelar tu turno?')) {
      setActiveTurnId(null);
      setMyTurn(null);
      setMyOrder(null);
      setCart([]);
      localStorage.removeItem('carniqr_turn_id');
      localStorage.removeItem('carniqr_turn_num');
      window.location.hash = '';
    }
  };

  // Cart operations
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { ...product, cantidad: 1 }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const nextQty = item.cantidad + delta;
        return nextQty > 0 ? { ...item, cantidad: nextQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const submitOrder = async () => {
    if (cart.length === 0 || !activeTurnId) return;
    try {
      const res = await fetch(`${API_BASE}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id: activeTurnId,
          items: cart.map(item => ({
            producto_id: item.id,
            cantidad: item.cantidad,
            precio: item.precio
          }))
        })
      });
      if (res.ok) {
        alert('¡Pedido anticipado enviado correctamente! Estará listo cuando te llamen.');
        setCart([]);
        setIsCartOpen(false);
        fetchMyOrderDetails();
      }
    } catch (e) {
      alert('Error al enviar el pedido');
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('carniqr_token', data.token);
        localStorage.setItem('carniqr_user', JSON.stringify(data.user));
        
        // Navigate based on role
        if (data.user.rol === 'admin') {
          window.location.hash = 'admin';
        } else {
          window.location.hash = 'empleado';
        }
      } else {
        setLoginError(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      setLoginError('Error de red al intentar iniciar sesión');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('carniqr_token');
    localStorage.removeItem('carniqr_user');
    window.location.hash = '';
  };

  // Employee queue calling actions
  const handleCallNext = async () => {
    try {
      const res = await fetch(`${API_BASE}/empleado/llamar-siguiente`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchEmployeeData();
      } else {
        const err = await res.json();
        alert(err.message || 'No hay más turnos');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateTurnStatus = async (turnId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/empleado/turnos/${turnId}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ estado: status })
      });
      if (res.ok) {
        fetchEmployeeData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/empleado/pedidos/${orderId}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ estado: status })
      });
      if (res.ok) {
        fetchEmployeeData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Admin CRUD operations
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = !!editingProductId;
      const url = isEditing 
        ? `${API_BASE}/admin/productos/${editingProductId}` 
        : `${API_BASE}/admin/productos`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newProduct,
          precio: parseFloat(newProduct.precio)
        })
      });
      if (res.ok) {
        alert(isEditing ? 'Producto actualizado con éxito' : 'Producto agregado con éxito');
        setNewProduct({ nombre: '', descripcion: '', precio: '', imagen: '', categoria_id: categories[0]?.id || '', activo: true });
        setEditingProductId(null);
        fetchData();
        fetchAdminStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditProduct = (prod: any) => {
    setEditingProductId(prod.id);
    setNewProduct({
      nombre: prod.nombre,
      descripcion: prod.descripcion || '',
      precio: String(prod.precio),
      imagen: prod.imagen || '',
      categoria_id: prod.categoria_id,
      activo: !!prod.activo
    });
  };

  const handleDeleteProduct = async (prodId: string) => {
    if (confirm('¿Seguro que deseas eliminar este producto?')) {
      try {
        const res = await fetch(`${API_BASE}/admin/productos/${prodId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          fetchData();
          fetchAdminStats();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = !!editingPromoId;
      const url = isEditing 
        ? `${API_BASE}/admin/promociones/${editingPromoId}` 
        : `${API_BASE}/admin/promociones`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newPromo,
          precio: parseFloat(newPromo.precio)
        })
      });
      if (res.ok) {
        alert(isEditing ? 'Promoción actualizada con éxito' : 'Promoción agregada con éxito');
        setNewPromo({ titulo: '', descripcion: '', precio: '', imagen: '', fecha_inicio: '', fecha_fin: '', activa: true });
        setEditingPromoId(null);
        fetchData();
        fetchAdminStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditPromo = (promo: any) => {
    setEditingPromoId(promo.id);
    setNewPromo({
      titulo: promo.titulo,
      descripcion: promo.descripcion,
      precio: String(promo.precio),
      imagen: promo.imagen || '',
      fecha_inicio: promo.fecha_inicio,
      fecha_fin: promo.fecha_fin,
      activa: !!promo.activa
    });
  };

  const handleDeletePromo = async (promoId: string) => {
    if (confirm('¿Seguro que deseas eliminar esta promoción?')) {
      try {
        const res = await fetch(`${API_BASE}/admin/promociones/${promoId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          fetchData();
          fetchAdminStats();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Filter products by category
  const filteredProducts = activeCategory === 'all' 
    ? products 
    : products.filter(p => p.categoria_id === activeCategory);

  const cartTotal = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  return (
    <div className="app-container">
      {/* Navbar */}
      <header className="navbar">
        <a href="#" className="brand">
          <UtensilsCrossed size={28} className="brand-dot" />
          <span>Carni<span>QR</span></span>
        </a>
        <div className="nav-links">
          {token ? (
            <>
              <span className="nav-link" style={{ color: 'var(--primary)' }}>
                Hola, {user?.nombre} ({user?.rol === 'admin' ? 'Admin' : 'Personal'})
              </span>
              <a href={user?.rol === 'admin' ? '#admin' : '#empleado'} className="nav-link">
                Dashboard
              </a>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 1rem' }}>
                <LogOut size={16} /> Salir
              </button>
            </>
          ) : (
            <>
              {activeTurnId && <a href={`#turno/${activeTurnId}`} className="nav-link">Mi Turno</a>}
              <a href="#login" className="nav-link">Personal</a>
            </>
          )}
        </div>
      </header>

      <main className="main-content">
        {/* LANDING PAGE (Client Welcome) */}
        {currentPath === '' && (
          <div className="hero-section">
            <h1 className="hero-title">
              Tu turno digital en <span>CarniQR</span>
            </h1>
            <p className="hero-subtitle">
              Escanea, obtén tu número de atención y realiza tu pedido de forma anticipada. Ahorra tiempo, evita filas físicas.
            </p>
            
            <div className="glass-panel" style={{ padding: '2.5rem', width: '100%', maxWidth: '450px' }}>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>¿Listo para comprar?</h3>
              <button onClick={handleGetTurn} className="btn btn-primary btn-block" style={{ fontSize: '1.2rem', padding: '1rem' }}>
                <Maximize size={24} /> Obtener Mi Turno
              </button>
              
              <div className="queue-status-grid" style={{ marginBottom: '0', paddingBottom: '0', borderBottom: 'none' }}>
                <div className="queue-stat-item">
                  <div className="queue-stat-value">{queueState.turnoLlamado || '-'}</div>
                  <div className="queue-stat-label">Llamando</div>
                </div>
                <div className="queue-stat-item">
                  <div className="queue-stat-value">{queueState.esperando}</div>
                  <div className="queue-stat-label">En Espera</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CLIENT TICKET VIEW */}
        {currentPath === 'turno' && myTurn && (
          <div className="ticket-container">
            {/* Ticket Info Card */}
            <div>
              <div className="glass-panel ticket-card" style={{ marginBottom: '1.5rem' }}>
                <div className="ticket-number-label">Tu Turno</div>
                <div className="ticket-number-value">{myTurn.numero}</div>
                <div className="status-badge llamado pulse-animation" style={{ textTransform: 'uppercase' }}>
                  Estado: {myTurn.estado}
                </div>

                <div className="queue-status-grid">
                  <div className="queue-stat-item">
                    <div className="queue-stat-value">{queueState.turnoLlamado}</div>
                    <div className="queue-stat-label">Llamando actual</div>
                  </div>
                  <div className="queue-stat-item">
                    <div className="queue-stat-value">{myTurn.personasDelante}</div>
                    <div className="queue-stat-label">Personas delante</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                  <Clock size={18} />
                  <span>Espera estimada: <strong>{myTurn.tiempoEstimado} mins</strong></span>
                </div>

                <button onClick={handleCancelTurn} className="btn btn-secondary" style={{ marginTop: '1.5rem', width: '100%' }}>
                  Abandonar Fila
                </button>
              </div>

              {/* Pre-order details */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingBag size={20} className="brand-dot" /> Pedido Anticipado
                </h3>
                {myOrder ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="status-badge atendido" style={{ textTransform: 'uppercase' }}>
                        Estado Pedido: {myOrder.estado}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        ID: #{myOrder.id.slice(0, 8)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      {myOrder.items?.map((item: any) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                          <span>{item.cantidad}x {item.producto_nombre}</span>
                          <span>{formatPrice(item.precio * item.cantidad)}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>Total</span>
                        <span>
                          {formatPrice(myOrder.items?.reduce((sum: number, i: any) => sum + (i.precio * i.cantidad), 0) || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Agrega productos del catálogo de abajo para pre-armar tu pedido y retirarlo directamente cuando te llamen.
                  </p>
                )}
              </div>
            </div>

            {/* Catalog & Promotions Panel */}
            <div className="catalog-section">
              {/* Active Promotions Carousel */}
              {promotions.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Percent size={20} className="brand-dot" /> Ofertas Imperdibles
                  </h3>
                  <div className="promo-list">
                    {promotions.map((promo) => (
                      <div key={promo.id} className="promo-card glass-panel" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {promo.imagen && (
                          <img 
                            src={promo.imagen.startsWith('http') ? promo.imagen : `/${promo.imagen}`} 
                            alt={promo.titulo} 
                            style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} 
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div className="promo-title">{promo.titulo}</div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{promo.descripcion}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div className="promo-price-tag" style={{ marginTop: 0 }}>{formatPrice(promo.precio)}</div>
                            {!myOrder && (
                              <button 
                                onClick={() => addToCart({ id: promo.id, nombre: promo.titulo, precio: promo.precio, imagen: promo.imagen, descripcion: promo.descripcion })} 
                                className="btn btn-primary" 
                                style={{ padding: '0.35rem 0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}
                              >
                                <Plus size={14} /> Pedir Oferta
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Catalog tab filter */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.25rem' }}>Catálogo de Productos</h3>
                <div className="category-tabs">
                  <button 
                    onClick={() => setActiveCategory('all')} 
                    className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
                  >
                    Todos
                  </button>
                  {categories.map((cat) => (
                    <button 
                      key={cat.id} 
                      onClick={() => setActiveCategory(cat.id)} 
                      className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                    >
                      {cat.nombre}
                    </button>
                  ))}
                </div>

                <div className="products-grid" style={{ marginTop: '1.5rem' }}>
                  {filteredProducts.map((prod) => (
                    <div key={prod.id} className="product-card">
                      {prod.imagen ? (
                        <img 
                          src={prod.imagen.startsWith('http') ? prod.imagen : `/${prod.imagen}`} 
                          alt={prod.nombre} 
                          style={{ height: '150px', width: '100%', objectFit: 'cover' }} 
                        />
                      ) : (
                        <div className="product-img-placeholder">
                          <UtensilsCrossed size={32} style={{ opacity: 0.15 }} />
                        </div>
                      )}
                      <div className="product-info">
                        <div className="product-name">{prod.nombre}</div>
                        <div className="product-desc">{prod.descripcion}</div>
                        <div className="product-footer">
                          <span className="product-price">{formatPrice(prod.precio)}</span>
                          {!myOrder && (
                            <button onClick={() => addToCart(prod)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', borderRadius: '4px' }}>
                              <Plus size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CART FLOATING BAR & MODAL */}
        {currentPath === 'turno' && cart.length > 0 && !myOrder && (
          <>
            <button onClick={() => setIsCartOpen(true)} className="cart-floating">
              <ShoppingBag size={20} />
              <span>Mi Pedido ({cart.reduce((sum, item) => sum + item.cantidad, 0)})</span>
            </button>

            {isCartOpen && (
              <div className="modal-overlay" onClick={() => setIsCartOpen(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Confirmar Pedido Anticipado</h3>
                    <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <div className="modal-body">
                    {cart.map(item => (
                      <div key={item.id} className="cart-item">
                        <div>
                          <div style={{ fontWeight: '600' }}>{item.nombre}</div>
                          <div style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{formatPrice(item.precio)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <button onClick={() => updateCartQuantity(item.id, -1)} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }}>-</button>
                          <span>{item.cantidad}</span>
                          <button onClick={() => updateCartQuantity(item.id, 1)} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }}>+</button>
                          <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', marginLeft: '0.5rem' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold' }}>
                      <span>Total estimado</span>
                      <span>{formatPrice(cartTotal)}</span>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button onClick={() => setIsCartOpen(false)} className="btn btn-secondary">Cerrar</button>
                    <button onClick={submitOrder} className="btn btn-primary">Enviar Pedido</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* LOGIN SCREEN */}
        {currentPath === 'login' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <div className="glass-panel" style={{ padding: '2.5rem', width: '100%', maxWidth: '400px' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Ingreso Personal</h2>
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Email</label>
                  <input 
                    type="email" 
                    value={loginEmail} 
                    onChange={e => setLoginEmail(e.target.value)} 
                    className="form-control" 
                    placeholder="email@carniqr.com" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <input 
                    type="password" 
                    value={loginPassword} 
                    onChange={e => setLoginPassword(e.target.value)} 
                    className="form-control" 
                    placeholder="••••••••" 
                    required 
                  />
                </div>
                {loginError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{loginError}</p>}
                <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '1rem' }}>
                  Ingresar
                </button>
              </form>
              <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Acceso para Empleados y Administradores.
              </p>
            </div>
          </div>
        )}

        {/* EMPLOYEE PANEL */}
        {currentPath === 'empleado' && token && (
          <div className="dashboard-grid">
            <div>
              {/* Turn management board */}
              <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2>Panel de Atención</h2>
                  <button onClick={handleCallNext} className="btn btn-success">
                    <Play size={18} /> Llamar Siguiente
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="turn-table">
                    <thead>
                      <tr>
                        <th>N° Turno</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeTurns.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay turnos registrados hoy</td>
                        </tr>
                      ) : (
                        employeeTurns.map(t => (
                          <tr key={t.id} style={{ background: t.estado === 'Llamado' ? 'rgba(220, 38, 38, 0.05)' : 'none' }}>
                            <td style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>#{t.numero}</td>
                            <td>
                              <span className={`status-badge ${t.estado.toLowerCase()}`}>
                                {t.estado}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => handleUpdateTurnStatus(t.id, 'Llamado')} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                                  Llamar
                                </button>
                                <button onClick={() => handleUpdateTurnStatus(t.id, 'Atendido')} className="btn btn-success" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                                  <CheckCircle size={14} /> Atender
                                </button>
                                <button onClick={() => handleUpdateTurnStatus(t.id, 'Ausente')} className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                                  <XCircle size={14} /> Ausente
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Orders drawer for employee */}
            <div>
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h2>Pedidos Anticipados</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  {employeeOrders.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay pedidos registrados</p>
                  ) : (
                    employeeOrders.map(order => (
                      <div key={order.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <strong>Turno #{order.turno_numero}</strong>
                          <span className={`status-badge ${order.estado === 'Entregado' ? 'atendido' : 'esperando'}`}>
                            {order.estado}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          {order.items.map((i: any) => `${i.cantidad}x ${i.producto_nombre}`).join(', ')}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'Preparando')} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                            Preparar
                          </button>
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'Listo')} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                            Listo
                          </button>
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'Entregado')} className="btn btn-success" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                            Entregar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN DASHBOARD */}
        {currentPath === 'admin' && token && user?.rol === 'admin' && (
          <div>
            <div className="admin-stats-grid">
              <div className="glass-panel stat-card">
                <div className="queue-stat-label">Turnos Emitidos</div>
                <div className="stat-num">{adminStats?.turnosEmitidos || 0}</div>
              </div>
              <div className="glass-panel stat-card">
                <div className="queue-stat-label">Clientes Atendidos</div>
                <div className="stat-num" style={{ color: 'var(--success)' }}>{adminStats?.clientesAtendidos || 0}</div>
              </div>
              <div className="glass-panel stat-card">
                <div className="queue-stat-label">Pedidos Realizados</div>
                <div className="stat-num" style={{ color: 'var(--warning)' }}>{adminStats?.pedidosRealizados || 0}</div>
              </div>
              <div className="glass-panel stat-card">
                <div className="queue-stat-label">Tiempo Espera Promedio</div>
                <div className="stat-num">{adminStats?.tiempoPromedioEspera || 12}m</div>
              </div>
            </div>

            {/* ABM Panel switches */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="category-tabs" style={{ marginBottom: 0 }}>
                <button onClick={() => setCrudMode('productos')} className={`category-tab ${crudMode === 'productos' ? 'active' : ''}`}>
                  Gestión de Productos
                </button>
                <button onClick={() => setCrudMode('promociones')} className={`category-tab ${crudMode === 'promociones' ? 'active' : ''}`}>
                  Gestión de Promociones
                </button>
              </div>
              <button onClick={() => setIsQrModalOpen(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={18} /> Ver QR de Acceso
              </button>
            </div>

            {isQrModalOpen && (
              <div className="modal-overlay" onClick={() => setIsQrModalOpen(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                  <div className="modal-header">
                    <h3>Código QR para Clientes</h3>
                    <button onClick={() => setIsQrModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                  </div>
                  <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      Los clientes pueden escanear este código QR con sus teléfonos móviles para ingresar al turnero y ver el catálogo.
                    </p>
                    <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', display: 'inline-block' }}>
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin)}`} 
                        alt="QR Code" 
                        style={{ display: 'block', width: '250px', height: '250px' }}
                      />
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Enlace de la aplicación:</div>
                      <a href={window.location.origin} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>
                        {window.location.origin}
                      </a>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button onClick={() => window.print()} className="btn btn-primary" style={{ marginRight: 'auto' }}>Imprimir</button>
                    <button onClick={() => setIsQrModalOpen(false)} className="btn btn-secondary">Cerrar</button>
                  </div>
                </div>
              </div>
            )}

            {crudMode === 'productos' ? (
              <div className="dashboard-grid">
                {/* Form Add/Edit Product */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3>{editingProductId ? 'Editar Producto' : 'Agregar Producto'}</h3>
                  <form onSubmit={handleAddProduct} style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label>Nombre</label>
                      <input 
                        type="text" 
                        value={newProduct.nombre} 
                        onChange={e => setNewProduct(prev => ({ ...prev, nombre: e.target.value }))}
                        className="form-control" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Descripción</label>
                      <textarea 
                        value={newProduct.descripcion} 
                        onChange={e => setNewProduct(prev => ({ ...prev, descripcion: e.target.value }))}
                        className="form-control" 
                        rows={2}
                      />
                    </div>
                    <div className="form-group">
                      <label>Precio</label>
                      <input 
                        type="number" 
                        value={newProduct.precio} 
                        onChange={e => setNewProduct(prev => ({ ...prev, precio: e.target.value }))}
                        className="form-control" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Imagen (Nombre o URL)</label>
                      <input 
                        type="text" 
                        value={newProduct.imagen} 
                        onChange={e => setNewProduct(prev => ({ ...prev, imagen: e.target.value }))}
                        className="form-control" 
                        placeholder="ej. asado_tira.jpg"
                      />
                    </div>
                    <div className="form-group">
                      <label>Categoría</label>
                      <select 
                        value={newProduct.categoria_id} 
                        onChange={e => setNewProduct(prev => ({ ...prev, categoria_id: e.target.value }))}
                        className="form-control"
                      >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary btn-block">
                        {editingProductId ? 'Actualizar Producto' : 'Guardar Producto'}
                      </button>
                      {editingProductId && (
                        <button 
                          type="button" 
                          onClick={() => {
                            setEditingProductId(null);
                            setNewProduct({ nombre: '', descripcion: '', precio: '', imagen: '', categoria_id: categories[0]?.id || '', activo: true });
                          }} 
                          className="btn btn-secondary"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* List of Products */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3>Listado de Productos</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    {products.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <div>
                          <strong>{p.nombre}</strong>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {formatPrice(p.precio)} {p.imagen && `| Img: ${p.imagen}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => startEditProduct(p)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDeleteProduct(p.id)} className="btn btn-danger" style={{ padding: '0.3rem 0.6rem' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="dashboard-grid">
                {/* Form Add/Edit Promo */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3>{editingPromoId ? 'Editar Promoción' : 'Agregar Promoción'}</h3>
                  <form onSubmit={handleAddPromo} style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label>Título</label>
                      <input 
                        type="text" 
                        value={newPromo.titulo} 
                        onChange={e => setNewPromo(prev => ({ ...prev, titulo: e.target.value }))}
                        className="form-control" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Descripción</label>
                      <textarea 
                        value={newPromo.descripcion} 
                        onChange={e => setNewPromo(prev => ({ ...prev, descripcion: e.target.value }))}
                        className="form-control" 
                        rows={2}
                      />
                    </div>
                    <div className="form-group">
                      <label>Precio Promocional</label>
                      <input 
                        type="number" 
                        value={newPromo.precio} 
                        onChange={e => setNewPromo(prev => ({ ...prev, precio: e.target.value }))}
                        className="form-control" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Imagen (Nombre o URL)</label>
                      <input 
                        type="text" 
                        value={newPromo.imagen} 
                        onChange={e => setNewPromo(prev => ({ ...prev, imagen: e.target.value }))}
                        className="form-control" 
                        placeholder="ej. combo_parrilla.jpg"
                      />
                    </div>
                    <div className="form-group">
                      <label>Fecha Inicio</label>
                      <input 
                        type="date" 
                        value={newPromo.fecha_inicio} 
                        onChange={e => setNewPromo(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                        className="form-control" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Fecha Fin</label>
                      <input 
                        type="date" 
                        value={newPromo.fecha_fin} 
                        onChange={e => setNewPromo(prev => ({ ...prev, fecha_fin: e.target.value }))}
                        className="form-control" 
                        required 
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary btn-block">
                        {editingPromoId ? 'Actualizar Promoción' : 'Guardar Promoción'}
                      </button>
                      {editingPromoId && (
                        <button 
                          type="button" 
                          onClick={() => {
                            setEditingPromoId(null);
                            setNewPromo({ titulo: '', descripcion: '', precio: '', imagen: '', fecha_inicio: '', fecha_fin: '', activa: true });
                          }} 
                          className="btn btn-secondary"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* List of Promos */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3>Listado de Promociones</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    {promotions.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <div>
                          <strong>{p.titulo}</strong>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {formatPrice(p.precio)} - Vence {p.fecha_fin} {p.imagen && `| Img: ${p.imagen}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => startEditPromo(p)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDeletePromo(p.id)} className="btn btn-danger" style={{ padding: '0.3rem 0.6rem' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        &copy; {new Date().getFullYear()} CarniQR. Todos los derechos reservados.
      </footer>
    </div>
  );
}
