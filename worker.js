// Cloudflare Worker pour Clarity v4.0
// API REST pour authentification et gestion des données

// Fonction pour générer des IDs uniques
function nanoid(size = 21) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  const randomValues = new Uint8Array(size);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < size; i++) {
    id += alphabet[randomValues[i] % alphabet.length];
  }
  return id;
}

// Configuration CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Fonction pour hacher les mots de passe (simple pour démo, à améliorer en production)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fonction pour générer un token JWT simple
function generateToken(userId) {
  return btoa(JSON.stringify({ userId, exp: Date.now() + 86400000 })); // 24h
}

// Fonction pour vérifier le token
function verifyToken(token) {
  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

// Router principal
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Gérer les requêtes OPTIONS (CORS)
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Routes d'authentification
      if (path === '/api/auth/signup' && method === 'POST') {
        return handleSignup(request, env);
      }

      if (path === '/api/auth/login' && method === 'POST') {
        return handleLogin(request, env);
      }

      if (path === '/api/auth/session' && method === 'GET') {
        return handleSession(request, env);
      }

      // Routes produits
      if (path === '/api/products' && method === 'GET') {
        return handleGetProducts(request, env);
      }

      if (path === '/api/products' && method === 'POST') {
        return handleCreateProducts(request, env);
      }

      if (path === '/api/products' && method === 'DELETE') {
        return handleDeleteProducts(request, env);
      }

      // Routes factures
      if (path === '/api/invoices' && method === 'GET') {
        return handleGetInvoices(request, env);
      }

      if (path === '/api/invoices' && method === 'POST') {
        return handleCreateInvoice(request, env);
      }

      // Routes clients
      if (path === '/api/clients' && method === 'GET') {
        return handleGetClients(request, env);
      }

      return jsonResponse({ error: 'Route not found' }, 404);
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

// ============================================
// HANDLERS - AUTHENTIFICATION
// ============================================

async function handleSignup(request, env) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return jsonResponse({ error: 'Email et mot de passe requis' }, 400);
  }

  // Vérifier si l'utilisateur existe
  const existingUser = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existingUser) {
    return jsonResponse({ error: 'Cet email est déjà utilisé' }, 400);
  }

  // Créer l'utilisateur
  const userId = nanoid();
  const passwordHash = await hashPassword(password);

  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
  ).bind(userId, email, passwordHash).run();

  return jsonResponse({
    user: { id: userId, email },
    message: 'Compte créé avec succès'
  });
}

async function handleLogin(request, env) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return jsonResponse({ error: 'Email et mot de passe requis' }, 400);
  }

  // Récupérer l'utilisateur
  const user = await env.DB.prepare(
    'SELECT id, email, password_hash FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user) {
    return jsonResponse({ error: 'Email ou mot de passe incorrect' }, 401);
  }

  // Vérifier le mot de passe
  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.password_hash) {
    return jsonResponse({ error: 'Email ou mot de passe incorrect' }, 401);
  }

  // Générer un token
  const token = generateToken(user.id);

  return jsonResponse({
    user: { id: user.id, email: user.email },
    token
  });
}

async function handleSession(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ session: null }, 200);
  }

  const token = authHeader.replace('Bearer ', '');
  const userId = verifyToken(token);

  if (!userId) {
    return jsonResponse({ session: null }, 200);
  }

  const user = await env.DB.prepare(
    'SELECT id, email FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    return jsonResponse({ session: null }, 200);
  }

  return jsonResponse({
    session: { user }
  });
}

// ============================================
// HANDLERS - PRODUITS
// ============================================

async function handleGetProducts(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const products = await env.DB.prepare(
    'SELECT * FROM products WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();

  return jsonResponse({ data: products.results || [] });
}

async function handleCreateProducts(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const { products } = await request.json();

  // Insérer les produits
  for (const product of products) {
    const productId = nanoid();
    await env.DB.prepare(
      `INSERT INTO products (id, user_id, reference, designation, ean, purchase_price, selling_price, art_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      productId,
      userId,
      product.reference || '',
      product.designation || '',
      product.ean || '',
      product.purchase_price || 0,
      product.selling_price || 0,
      product.art_group || ''
    ).run();
  }

  return jsonResponse({ message: 'Produits créés avec succès' });
}

async function handleDeleteProducts(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  await env.DB.prepare(
    'DELETE FROM products WHERE user_id = ?'
  ).bind(userId).run();

  return jsonResponse({ message: 'Produits supprimés avec succès' });
}

// ============================================
// HANDLERS - FACTURES
// ============================================

async function handleGetInvoices(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const invoices = await env.DB.prepare(
    'SELECT * FROM invoices WHERE user_id = ? ORDER BY invoice_date DESC'
  ).bind(userId).all();

  return jsonResponse({ data: invoices.results || [] });
}

async function handleCreateInvoice(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const { invoice } = await request.json();
  const invoiceId = nanoid();

  await env.DB.prepare(
    `INSERT INTO invoices (id, user_id, invoice_number, client_name, total_ht, vat, total_ttc, items)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    invoiceId,
    userId,
    invoice.invoice_number,
    invoice.client_name,
    invoice.total_ht,
    invoice.vat,
    invoice.total_ttc,
    JSON.stringify(invoice.items)
  ).run();

  return jsonResponse({ message: 'Facture créée avec succès', id: invoiceId });
}

// ============================================
// HANDLERS - CLIENTS
// ============================================

async function handleGetClients(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const clients = await env.DB.prepare(
    'SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();

  return jsonResponse({ data: clients.results || [] });
}

// ============================================
// UTILITAIRES
// ============================================

async function getUserIdFromRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  return verifyToken(token);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
