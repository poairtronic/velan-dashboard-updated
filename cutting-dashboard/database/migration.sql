-- PRODUCTION CUTTING DASHBOARD MIGRATION

CREATE TABLE long_bars (
  id SERIAL PRIMARY KEY,
  bar_type VARCHAR(50) NOT NULL,
  original_length INT NOT NULL,
  current_length INT NOT NULL,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cut_pieces (
  id SERIAL PRIMARY KEY,
  cut_piece_name VARCHAR(100) UNIQUE NOT NULL,
  parent_bar_type VARCHAR(50) NOT NULL,
  cut_dimension INT NOT NULL,
  unit VARCHAR(10) DEFAULT 'mm',
  min_stock_threshold INT DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cut_piece_inventory (
  id SERIAL PRIMARY KEY,
  cut_piece_id INT NOT NULL UNIQUE REFERENCES cut_pieces(id),
  quantity_available INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE production_logs (
  id SERIAL PRIMARY KEY,
  long_bar_id INT NOT NULL REFERENCES long_bars(id),
  cut_piece_id INT NOT NULL REFERENCES cut_pieces(id),
  cut_dimension INT NOT NULL,
  bar_length_before INT NOT NULL,
  bar_length_after INT NOT NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Note: We are not inserting initial dummy data as the dashboard will handle creating/fetching them directly.
