DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  name TEXT,
  street TEXT,
  zipCode TEXT,
  city TEXT,
  siret TEXT,
  vatNumber TEXT,
  phone TEXT,
  logo TEXT,
  primaryColor TEXT,
  rcs TEXT,
  ape TEXT,
  capital TEXT,
  headquarters TEXT
);

DROP TABLE IF EXISTS current_invoice;
CREATE TABLE current_invoice (
  id INTEGER PRIMARY KEY,
  invoiceNumber TEXT,
  date TEXT,
  covers INTEGER,
  client_companyName TEXT,
  client_address TEXT,
  description TEXT,
  amountHT10 REAL,
  amountHT20 REAL,
  full_data TEXT
);

DROP TABLE IF EXISTS invoices_history;
CREATE TABLE invoices_history (
  id INTEGER PRIMARY KEY,
  invoiceNumber TEXT,
  clientName TEXT,
  totalTTC REAL,
  date TEXT,
  full_data TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE IF EXISTS prestations;
CREATE TABLE prestations (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL
);

