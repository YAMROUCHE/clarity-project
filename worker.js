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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
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

      // Routes produits individuels
      if (path.startsWith('/api/products/') && method === 'PUT') {
        const productId = path.split('/').pop();
        return handleUpdateProduct(request, env, productId);
      }

      if (path.startsWith('/api/products/') && method === 'DELETE') {
        const productId = path.split('/').pop();
        return handleDeleteProduct(request, env, productId);
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

      if (path === '/api/clients' && method === 'POST') {
        return handleCreateClient(request, env);
      }

      // Routes clients individuels
      if (path.startsWith('/api/clients/') && method === 'PUT') {
        const clientId = path.split('/').pop();
        return handleUpdateClient(request, env, clientId);
      }

      if (path.startsWith('/api/clients/') && method === 'DELETE') {
        const clientId = path.split('/').pop();
        return handleDeleteClient(request, env, clientId);
      }

      // Routes comptables - Charges
      if (path === '/api/charges' && method === 'GET') {
        return handleGetCharges(request, env);
      }

      if (path === '/api/charges' && method === 'POST') {
        return handleCreateCharge(request, env);
      }

      if (path.startsWith('/api/charges/') && method === 'PUT') {
        const chargeId = path.split('/').pop();
        return handleUpdateCharge(request, env, chargeId);
      }

      if (path.startsWith('/api/charges/') && method === 'DELETE') {
        const chargeId = path.split('/').pop();
        return handleDeleteCharge(request, env, chargeId);
      }

      // Routes comptables - Plan comptable
      if (path === '/api/comptes' && method === 'GET') {
        return handleGetComptes(request, env);
      }

      if (path === '/api/comptes/init' && method === 'POST') {
        return handleInitComptes(request, env);
      }

      // Routes comptables - Écritures
      if (path === '/api/ecritures' && method === 'GET') {
        return handleGetEcritures(request, env);
      }

      if (path === '/api/ecritures' && method === 'POST') {
        return handleCreateEcriture(request, env);
      }

      // Routes comptables - Déclarations TVA
      if (path === '/api/declarations-tva' && method === 'GET') {
        return handleGetDeclarationsTVA(request, env);
      }

      if (path === '/api/declarations-tva' && method === 'POST') {
        return handleCreateDeclarationTVA(request, env);
      }

      // Routes comptables - Synthèse TVA
      if (path === '/api/tva/synthese' && method === 'GET') {
        return handleGetTVASynthese(request, env);
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

async function handleUpdateProduct(request, env, productId) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const { designation, ean, purchase_price, selling_price, art_group } = await request.json();

  await env.DB.prepare(
    `UPDATE products
     SET designation = ?, ean = ?, purchase_price = ?, selling_price = ?, art_group = ?
     WHERE id = ? AND user_id = ?`
  ).bind(designation, ean, purchase_price, selling_price, art_group, productId, userId).run();

  return jsonResponse({ message: 'Produit mis à jour avec succès' });
}

async function handleDeleteProduct(request, env, productId) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  await env.DB.prepare(
    'DELETE FROM products WHERE id = ? AND user_id = ?'
  ).bind(productId, userId).run();

  return jsonResponse({ message: 'Produit supprimé avec succès' });
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
    `INSERT INTO invoices (id, user_id, invoice_number, invoice_date, client_name, total_ht, vat, total_ttc, items)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    invoiceId,
    userId,
    invoice.invoice_number,
    invoice.invoice_date || new Date().toISOString(),
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

async function handleCreateClient(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const { name, address, siret } = await request.json();
  const clientId = nanoid();

  await env.DB.prepare(
    `INSERT INTO clients (id, user_id, name, address, siret)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(clientId, userId, name, address, siret || '').run();

  return jsonResponse({ message: 'Client créé avec succès', id: clientId });
}

async function handleUpdateClient(request, env, clientId) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const { name, address, siret } = await request.json();

  await env.DB.prepare(
    `UPDATE clients
     SET name = ?, address = ?, siret = ?
     WHERE id = ? AND user_id = ?`
  ).bind(name, address, siret || '', clientId, userId).run();

  return jsonResponse({ message: 'Client mis à jour avec succès' });
}

async function handleDeleteClient(request, env, clientId) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  await env.DB.prepare(
    'DELETE FROM clients WHERE id = ? AND user_id = ?'
  ).bind(clientId, userId).run();

  return jsonResponse({ message: 'Client supprimé avec succès' });
}

// ============================================
// HANDLERS - COMPTABILITÉ - CHARGES
// ============================================

async function handleGetCharges(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const charges = await env.DB.prepare(
    'SELECT * FROM charges WHERE user_id = ? ORDER BY date DESC'
  ).bind(userId).all();

  return jsonResponse({ data: charges.results || [] });
}

async function handleCreateCharge(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const { charge } = await request.json();
  const chargeId = nanoid();

  await env.DB.prepare(
    `INSERT INTO charges (id, user_id, date, category, description, amount_ht, vat_amount, amount_ttc, vat_rate, supplier, payment_method, compte_comptable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    chargeId,
    userId,
    charge.date,
    charge.category,
    charge.description || '',
    charge.amount_ht || 0,
    charge.vat_amount || 0,
    charge.amount_ttc || 0,
    charge.vat_rate || 20,
    charge.supplier || '',
    charge.payment_method || '',
    charge.compte_comptable || ''
  ).run();

  // Créer les écritures comptables automatiquement
  await createChargeEcritures(env, userId, chargeId, charge);

  return jsonResponse({ message: 'Charge créée avec succès', id: chargeId });
}

async function handleUpdateCharge(request, env, chargeId) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const { charge } = await request.json();

  await env.DB.prepare(
    `UPDATE charges
     SET date = ?, category = ?, description = ?, amount_ht = ?, vat_amount = ?, amount_ttc = ?, vat_rate = ?, supplier = ?, payment_method = ?, compte_comptable = ?
     WHERE id = ? AND user_id = ?`
  ).bind(
    charge.date,
    charge.category,
    charge.description || '',
    charge.amount_ht || 0,
    charge.vat_amount || 0,
    charge.amount_ttc || 0,
    charge.vat_rate || 20,
    charge.supplier || '',
    charge.payment_method || '',
    charge.compte_comptable || '',
    chargeId,
    userId
  ).run();

  return jsonResponse({ message: 'Charge mise à jour avec succès' });
}

async function handleDeleteCharge(request, env, chargeId) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  // Supprimer les écritures associées
  await env.DB.prepare(
    'DELETE FROM ecritures_comptables WHERE user_id = ? AND reference_id = ?'
  ).bind(userId, chargeId).run();

  // Supprimer la charge
  await env.DB.prepare(
    'DELETE FROM charges WHERE id = ? AND user_id = ?'
  ).bind(chargeId, userId).run();

  return jsonResponse({ message: 'Charge supprimée avec succès' });
}

// ============================================
// HANDLERS - COMPTABILITÉ - PLAN COMPTABLE
// ============================================

async function handleGetComptes(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const comptes = await env.DB.prepare(
    'SELECT * FROM comptes_comptables WHERE user_id = ? ORDER BY numero_compte'
  ).bind(userId).all();

  return jsonResponse({ data: comptes.results || [] });
}

async function handleInitComptes(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  // Plan comptable simplifié pour PME
  const planComptable = [
    // Classe 4 - Comptes de tiers
    { numero: '401', libelle: 'Fournisseurs', classe: 4, type: 'passif' },
    { numero: '411', libelle: 'Clients', classe: 4, type: 'actif' },
    { numero: '445', libelle: 'État - TVA', classe: 4, type: 'passif' },
    { numero: '4456', libelle: 'TVA déductible', classe: 4, type: 'actif' },
    { numero: '4457', libelle: 'TVA collectée', classe: 4, type: 'passif' },

    // Classe 6 - Charges
    { numero: '606', libelle: 'Achats de matières premières', classe: 6, type: 'charge' },
    { numero: '607', libelle: 'Achats de marchandises', classe: 6, type: 'charge' },
    { numero: '61', libelle: 'Services extérieurs', classe: 6, type: 'charge' },
    { numero: '613', libelle: 'Locations', classe: 6, type: 'charge' },
    { numero: '615', libelle: 'Entretien et réparations', classe: 6, type: 'charge' },
    { numero: '616', libelle: 'Primes d\'assurance', classe: 6, type: 'charge' },
    { numero: '62', libelle: 'Autres services extérieurs', classe: 6, type: 'charge' },
    { numero: '622', libelle: 'Rémunérations d\'intermédiaires', classe: 6, type: 'charge' },
    { numero: '626', libelle: 'Frais postaux et télécommunications', classe: 6, type: 'charge' },
    { numero: '627', libelle: 'Services bancaires', classe: 6, type: 'charge' },
    { numero: '63', libelle: 'Impôts et taxes', classe: 6, type: 'charge' },
    { numero: '64', libelle: 'Charges de personnel', classe: 6, type: 'charge' },
    { numero: '641', libelle: 'Salaires bruts', classe: 6, type: 'charge' },
    { numero: '645', libelle: 'Charges sociales', classe: 6, type: 'charge' },

    // Classe 7 - Produits
    { numero: '707', libelle: 'Ventes de marchandises', classe: 7, type: 'produit' },
    { numero: '708', libelle: 'Produits des activités annexes', classe: 7, type: 'produit' },
    { numero: '71', libelle: 'Production vendue', classe: 7, type: 'produit' },
  ];

  for (const compte of planComptable) {
    const compteId = nanoid();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO comptes_comptables (id, user_id, numero_compte, libelle, classe, type)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      compteId,
      userId,
      compte.numero,
      compte.libelle,
      compte.classe,
      compte.type
    ).run();
  }

  return jsonResponse({ message: 'Plan comptable initialisé avec succès' });
}

// ============================================
// HANDLERS - COMPTABILITÉ - ÉCRITURES
// ============================================

async function handleGetEcritures(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const ecritures = await env.DB.prepare(
    'SELECT * FROM ecritures_comptables WHERE user_id = ? ORDER BY date DESC, created_at DESC'
  ).bind(userId).all();

  return jsonResponse({ data: ecritures.results || [] });
}

async function handleCreateEcriture(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const { ecriture } = await request.json();
  const ecritureId = nanoid();

  await env.DB.prepare(
    `INSERT INTO ecritures_comptables (id, user_id, date, journal, numero_piece, compte, libelle, debit, credit, reference_id, reference_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    ecritureId,
    userId,
    ecriture.date,
    ecriture.journal,
    ecriture.numero_piece || '',
    ecriture.compte,
    ecriture.libelle,
    ecriture.debit || 0,
    ecriture.credit || 0,
    ecriture.reference_id || null,
    ecriture.reference_type || null
  ).run();

  return jsonResponse({ message: 'Écriture créée avec succès', id: ecritureId });
}

// ============================================
// HANDLERS - COMPTABILITÉ - TVA
// ============================================

async function handleGetDeclarationsTVA(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const declarations = await env.DB.prepare(
    'SELECT * FROM declarations_tva WHERE user_id = ? ORDER BY period_start DESC'
  ).bind(userId).all();

  return jsonResponse({ data: declarations.results || [] });
}

async function handleCreateDeclarationTVA(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const { declaration } = await request.json();
  const declarationId = nanoid();

  await env.DB.prepare(
    `INSERT INTO declarations_tva (id, user_id, period_start, period_end, tva_collectee, tva_deductible, tva_a_payer, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    declarationId,
    userId,
    declaration.period_start,
    declaration.period_end,
    declaration.tva_collectee || 0,
    declaration.tva_deductible || 0,
    declaration.tva_a_payer || 0,
    declaration.status || 'draft',
    declaration.status === 'submitted' ? new Date().toISOString() : null
  ).run();

  return jsonResponse({ message: 'Déclaration TVA créée avec succès', id: declarationId });
}

async function handleGetTVASynthese(request, env) {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Non authentifié' }, 401);
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get('start');
  const endDate = url.searchParams.get('end');

  // Calculer TVA collectée (ventes)
  const invoices = await env.DB.prepare(
    'SELECT * FROM invoices WHERE user_id = ? AND invoice_date >= ? AND invoice_date <= ?'
  ).bind(userId, startDate, endDate).all();

  let tvaCollectee = 0;
  invoices.results.forEach(invoice => {
    tvaCollectee += parseFloat(invoice.vat) || 0;
  });

  // Calculer TVA déductible (achats)
  const charges = await env.DB.prepare(
    'SELECT * FROM charges WHERE user_id = ? AND date >= ? AND date <= ?'
  ).bind(userId, startDate, endDate).all();

  let tvaDeductible = 0;
  charges.results.forEach(charge => {
    tvaDeductible += parseFloat(charge.vat_amount) || 0;
  });

  const tvaAPayer = tvaCollectee - tvaDeductible;

  return jsonResponse({
    tva_collectee: tvaCollectee,
    tva_deductible: tvaDeductible,
    tva_a_payer: tvaAPayer,
    invoices_count: invoices.results.length,
    charges_count: charges.results.length
  });
}

// Fonction utilitaire pour créer les écritures d'une charge
async function createChargeEcritures(env, userId, chargeId, charge) {
  const date = charge.date;
  const numeroPiece = `CHG-${chargeId.substring(0, 8)}`;

  // Débit du compte de charge
  await env.DB.prepare(
    `INSERT INTO ecritures_comptables (id, user_id, date, journal, numero_piece, compte, libelle, debit, credit, reference_id, reference_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    nanoid(),
    userId,
    date,
    'AC',
    numeroPiece,
    charge.compte_comptable || '607',
    charge.description,
    charge.amount_ht || 0,
    0,
    chargeId,
    'charge'
  ).run();

  // Débit de la TVA déductible
  if ((charge.vat_amount || 0) > 0) {
    await env.DB.prepare(
      `INSERT INTO ecritures_comptables (id, user_id, date, journal, numero_piece, compte, libelle, debit, credit, reference_id, reference_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      nanoid(),
      userId,
      date,
      'AC',
      numeroPiece,
      '4456',
      'TVA déductible - ' + charge.description,
      charge.vat_amount || 0,
      0,
      chargeId,
      'charge'
    ).run();
  }

  // Crédit du compte fournisseur
  await env.DB.prepare(
    `INSERT INTO ecritures_comptables (id, user_id, date, journal, numero_piece, compte, libelle, debit, credit, reference_id, reference_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    nanoid(),
    userId,
    date,
    'AC',
    numeroPiece,
    '401',
    'Fournisseur - ' + (charge.supplier || 'Divers'),
    0,
    charge.amount_ttc || 0,
    chargeId,
    'charge'
  ).run();
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
