-- Table Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table Products
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reference TEXT,
    designation TEXT,
    ean TEXT,
    purchase_price REAL DEFAULT 0,
    selling_price REAL DEFAULT 0,
    art_group TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table Clients
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    client_id TEXT,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    client_name TEXT,
    total_ht REAL DEFAULT 0,
    vat REAL DEFAULT 0,
    total_ttc REAL DEFAULT 0,
    items TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- Table Charges (dépenses)
CREATE TABLE IF NOT EXISTS charges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    category TEXT NOT NULL,
    description TEXT,
    amount_ht REAL DEFAULT 0,
    vat_amount REAL DEFAULT 0,
    amount_ttc REAL DEFAULT 0,
    vat_rate REAL DEFAULT 20,
    supplier TEXT,
    payment_method TEXT,
    compte_comptable TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table Plan Comptable
CREATE TABLE IF NOT EXISTS comptes_comptables (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    numero_compte TEXT NOT NULL,
    libelle TEXT NOT NULL,
    classe INTEGER NOT NULL,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, numero_compte)
);

-- Table Écritures Comptables (Livre Journal)
CREATE TABLE IF NOT EXISTS ecritures_comptables (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    journal TEXT NOT NULL,
    numero_piece TEXT,
    compte TEXT NOT NULL,
    libelle TEXT NOT NULL,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    reference_id TEXT,
    reference_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table Déclarations TVA
CREATE TABLE IF NOT EXISTS declarations_tva (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    tva_collectee REAL DEFAULT 0,
    tva_deductible REAL DEFAULT 0,
    tva_a_payer REAL DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_charges_user_id ON charges(user_id);
CREATE INDEX IF NOT EXISTS idx_charges_date ON charges(date);
CREATE INDEX IF NOT EXISTS idx_comptes_user_id ON comptes_comptables(user_id);
CREATE INDEX IF NOT EXISTS idx_ecritures_user_id ON ecritures_comptables(user_id);
CREATE INDEX IF NOT EXISTS idx_ecritures_date ON ecritures_comptables(date);
CREATE INDEX IF NOT EXISTS idx_declarations_tva_user_id ON declarations_tva(user_id);
