const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

// Middleware to wrap async route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET all long bars
router.get('/long-bars', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT 
      id, 
      bar_type as "barType", 
      original_length as "originalLength", 
      current_length as "currentLength", 
      status, 
      created_at as "createdAt", 
      updated_at as "updatedAt"
    FROM long_bars ORDER BY id DESC
  `);
  res.json(result.rows);
}));

// POST new long bar
router.post('/long-bars', asyncHandler(async (req, res) => {
  const { barType, originalLength } = req.body;
  if (!barType || !originalLength) {
    return res.status(400).json({ success: false, message: 'barType and originalLength are required' });
  }
  
  const result = await pool.query(
    `INSERT INTO long_bars (bar_type, original_length, current_length, status)
     VALUES ($1, $2, $3, 'Active') 
     RETURNING id, bar_type as "barType", original_length as "originalLength", current_length as "currentLength", status, created_at as "createdAt", updated_at as "updatedAt"`,
    [barType, originalLength, originalLength]
  );
  res.status(201).json(result.rows[0]);
}));

// GET all cut pieces
router.get('/cut-pieces', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM cut_pieces ORDER BY id DESC');
  res.json(result.rows);
}));

// POST define new cut piece
router.post('/cut-pieces/define', asyncHandler(async (req, res) => {
  const { cutPieceName, parentBarType, cutDimension } = req.body;
  if (!cutPieceName || !parentBarType || !cutDimension) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const cpRes = await client.query('SELECT * FROM cut_pieces WHERE cut_piece_name = $1', [cutPieceName]);
    if (cpRes.rows.length > 0) {
      throw new Error(`Cut piece with name "${cutPieceName}" already exists.`);
    }

    const insertCp = await client.query(
      'INSERT INTO cut_pieces (cut_piece_name, parent_bar_type, cut_dimension) VALUES ($1, $2, $3) RETURNING id',
      [cutPieceName, parentBarType, cutDimension]
    );
    const cutPieceId = insertCp.rows[0].id;

    await client.query(
      'INSERT INTO cut_piece_inventory (cut_piece_id, quantity_available) VALUES ($1, 0)',
      [cutPieceId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Cut piece defined successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}));

// GET inventory stock
router.get('/stock', asyncHandler(async (req, res) => {
  const query = `
    SELECT 
      inv.id,
      inv.quantity_available as "quantityAvailable",
      inv.updated_at as "updatedAt",
      cp.id as "cutPieceId",
      cp.cut_piece_name as "cutPieceName",
      cp.cut_dimension as "cutDimension",
      cp.parent_bar_type as "parentBarType"
    FROM cut_piece_inventory inv
    JOIN cut_pieces cp ON inv.cut_piece_id = cp.id
    ORDER BY inv.id DESC
  `;
  const result = await pool.query(query);
  
  // Format for frontend which expects a nested cutPiece object
  const formatted = result.rows.map(row => ({
    id: row.id,
    quantityAvailable: row.quantityAvailable,
    updatedAt: row.updatedAt,
    cutPiece: {
      id: row.cutPieceId,
      cutPieceName: row.cutPieceName,
      cutDimension: row.cutDimension,
      parentBarType: row.parentBarType
    }
  }));
  
  res.json(formatted);
}));

// GET production history
router.get('/production-history', asyncHandler(async (req, res) => {
  const query = `
    SELECT 
      pl.id,
      pl.cut_dimension as "cutDimension",
      pl.bar_length_before as "barLengthBefore",
      pl.bar_length_after as "barLengthAfter",
      pl.created_by as "createdBy",
      pl.created_at as "createdAt",
      lb.id as "longBarId",
      lb.bar_type as "barType",
      cp.id as "cutPieceId",
      cp.cut_piece_name as "cutPieceName"
    FROM production_log pl
    JOIN long_bars lb ON pl.long_bar_id = lb.id
    JOIN cut_pieces cp ON pl.cut_piece_id = cp.id
    ORDER BY pl.created_at DESC
    LIMIT 20
  `;
  const result = await pool.query(query);
  
  const formatted = result.rows.map(row => ({
    id: row.id,
    cutDimension: row.cutDimension,
    barLengthBefore: row.barLengthBefore,
    barLengthAfter: row.barLengthAfter,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    longBar: {
      id: row.longBarId,
      barType: row.barType
    },
    cutPiece: {
      id: row.cutPieceId,
      cutPieceName: row.cutPieceName
    }
  }));
  
  res.json(formatted);
}));

// POST cut piece (Atomic Transaction)
router.post('/cut-piece', asyncHandler(async (req, res) => {
  const { longBarId, cutPieceName, cutDimension, quantity, createdBy } = req.body;
  
  if (!longBarId || !cutPieceName || !cutDimension || !quantity) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Fetch Long Bar (Pessimistic write lock)
    const barRes = await client.query('SELECT * FROM long_bars WHERE id = $1 FOR UPDATE', [longBarId]);
    if (barRes.rows.length === 0) {
      throw new Error(`Long bar with ID ${longBarId} not found`);
    }
    const longBar = barRes.rows[0];
    
    // 2. Find or Create Cut Piece
    let cutPieceId;
    const cpRes = await client.query('SELECT * FROM cut_pieces WHERE cut_piece_name = $1', [cutPieceName]);
    if (cpRes.rows.length === 0) {
      const insertCp = await client.query(
        'INSERT INTO cut_pieces (cut_piece_name, parent_bar_type, cut_dimension) VALUES ($1, $2, $3) RETURNING id',
        [cutPieceName, longBar.bar_type, cutDimension]
      );
      cutPieceId = insertCp.rows[0].id;
    } else {
      const existingCp = cpRes.rows[0];
      if (Number(existingCp.cut_dimension) !== Number(cutDimension)) {
        throw new Error(`Existing cut piece "${cutPieceName}" has a different dimension (${existingCp.cut_dimension}mm) than requested (${cutDimension}mm).`);
      }
      cutPieceId = existingCp.id;
    }
    
    // 3. Validate Dimensions
    const totalReduction = cutDimension * quantity;
    const currentLength = Number(longBar.current_length);
    const originalLength = Number(longBar.original_length);

    if (currentLength < totalReduction) {
      throw new Error(`Insufficient length. Bar has ${currentLength}mm, but cut requires ${totalReduction}mm.`);
    }
    
    const lengthBefore = currentLength;
    const lengthAfter = lengthBefore - totalReduction;
    
    let newStatus = 'Active';
    if (lengthAfter <= 0) {
      newStatus = 'Depleted';
    } else if (lengthAfter < originalLength) {
      newStatus = 'Partial';
    }
    
    // 4. Update Long Bar
    await client.query(
      'UPDATE long_bars SET current_length = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [lengthAfter, newStatus, longBarId]
    );
    
    // 5. Update Inventory
    const invRes = await client.query('SELECT * FROM cut_piece_inventory WHERE cut_piece_id = $1 FOR UPDATE', [cutPieceId]);
    if (invRes.rows.length === 0) {
      await client.query(
        'INSERT INTO cut_piece_inventory (cut_piece_id, quantity_available) VALUES ($1, $2)',
        [cutPieceId, quantity]
      );
    } else {
      await client.query(
        'UPDATE cut_piece_inventory SET quantity_available = quantity_available + $1, updated_at = NOW() WHERE cut_piece_id = $2',
        [quantity, cutPieceId]
      );
    }
    
    // 6. Log Production
    await client.query(
      `INSERT INTO production_log 
        (long_bar_id, cut_piece_id, cut_dimension, bar_length_before, bar_length_after, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [longBarId, cutPieceId, cutDimension, lengthBefore, lengthAfter, createdBy || 'System']
    );

    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `Successfully cut ${quantity} piece(s) of "${cutPieceName}".`,
      data: {
        barLengthBefore: lengthBefore,
        barLengthAfter: lengthAfter,
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}));

// GET all fine blanks defined
router.get('/fine-blanks', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM fine_blanks ORDER BY id DESC');
  res.json(result.rows);
}));

// POST define new fine blank
router.post('/fine-blanks/define', asyncHandler(async (req, res) => {
  const { fineBlankName, parentCutPieceType, dimension, material, description } = req.body;
  if (!fineBlankName || !parentCutPieceType || !dimension) {
    return res.status(400).json({ success: false, message: 'Name, Parent Cut Piece, and Dimension are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const fbRes = await client.query('SELECT * FROM fine_blanks WHERE fine_blank_name = $1', [fineBlankName]);
    if (fbRes.rows.length > 0) {
      throw new Error(`Fine blank with name "${fineBlankName}" already exists.`);
    }

    const insertFb = await client.query(
      'INSERT INTO fine_blanks (fine_blank_name, parent_cut_piece_type, dimension, material, description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [fineBlankName, parentCutPieceType, dimension, material || '', description || '']
    );
    const fineBlankId = insertFb.rows[0].id;

    await client.query(
      'INSERT INTO fine_blank_inventory (fine_blank_id, quantity_available) VALUES ($1, 0)',
      [fineBlankId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Fine blank defined successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}));

// GET fine blank inventory stock
router.get('/fine-blank-stock', asyncHandler(async (req, res) => {
  const query = `
    SELECT 
      inv.id,
      inv.quantity_available as "quantityAvailable",
      inv.updated_at as "updatedAt",
      fb.id as "fineBlankId",
      fb.fine_blank_name as "fineBlankName",
      fb.parent_cut_piece_type as "parentCutPieceType",
      fb.dimension,
      fb.material
    FROM fine_blank_inventory inv
    JOIN fine_blanks fb ON inv.fine_blank_id = fb.id
    ORDER BY inv.id DESC
  `;
  const result = await pool.query(query);
  
  const formatted = result.rows.map(row => ({
    id: row.id,
    quantityAvailable: row.quantityAvailable,
    updatedAt: row.updatedAt,
    fineBlank: {
      id: row.fineBlankId,
      fineBlankName: row.fineBlankName,
      parentCutPieceType: row.parentCutPieceType,
      dimension: row.dimension,
      material: row.material
    }
  }));
  
  res.json(formatted);
}));

// GET fine blank production history
router.get('/fine-blank-history', asyncHandler(async (req, res) => {
  const query = `
    SELECT 
      log.id,
      log.consumed_qty as "consumedQty",
      log.produced_qty as "producedQty",
      log.remarks,
      log.created_by as "createdBy",
      log.created_at as "createdAt",
      cp.id as "cutPieceId",
      cp.cut_piece_name as "cutPieceName",
      fb.id as "fineBlankId",
      fb.fine_blank_name as "fineBlankName"
    FROM fine_blank_production_log log
    JOIN cut_pieces cp ON log.cut_piece_id = cp.id
    JOIN fine_blanks fb ON log.fine_blank_id = fb.id
    ORDER BY log.created_at DESC
    LIMIT 20
  `;
  const result = await pool.query(query);
  
  const formatted = result.rows.map(row => ({
    id: row.id,
    consumedQty: row.consumedQty,
    producedQty: row.producedQty,
    remarks: row.remarks,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    cutPiece: {
      id: row.cutPieceId,
      cutPieceName: row.cutPieceName
    },
    fineBlank: {
      id: row.fineBlankId,
      fineBlankName: row.fineBlankName
    }
  }));
  
  res.json(formatted);
}));

// POST fine blank produce (Atomic Transaction)
router.post('/fine-blank/produce', asyncHandler(async (req, res) => {
  const { cutPieceId, fineBlankName, consumedQty, producedQty, remarks, createdBy } = req.body;
  
  if (!cutPieceId || !fineBlankName || !consumedQty || !producedQty) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Fetch Cut Piece Inventory (Pessimistic write lock)
    const cpInvRes = await client.query('SELECT * FROM cut_piece_inventory WHERE cut_piece_id = $1 FOR UPDATE', [cutPieceId]);
    if (cpInvRes.rows.length === 0) {
      throw new Error(`Cut piece inventory not found`);
    }
    const cpInv = cpInvRes.rows[0];
    
    const availableQty = Number(cpInv.quantity_available);
    if (availableQty < Number(consumedQty)) {
      throw new Error(`Insufficient cut pieces. Have ${availableQty}, requested ${consumedQty}.`);
    }
    
    // 2. Find Fine Blank Definition
    const fbRes = await client.query('SELECT * FROM fine_blanks WHERE fine_blank_name = $1', [fineBlankName]);
    if (fbRes.rows.length === 0) {
      throw new Error(`Fine Blank "${fineBlankName}" not defined.`);
    }
    const fineBlank = fbRes.rows[0];
    
    // 3. Deduct from Cut Piece Inventory
    await client.query(
      'UPDATE cut_piece_inventory SET quantity_available = quantity_available - $1, updated_at = NOW() WHERE cut_piece_id = $2',
      [consumedQty, cutPieceId]
    );
    
    // 4. Update Fine Blank Inventory
    const fbInvRes = await client.query('SELECT * FROM fine_blank_inventory WHERE fine_blank_id = $1 FOR UPDATE', [fineBlank.id]);
    if (fbInvRes.rows.length === 0) {
      // Should exist from definition step, but fallback just in case
      await client.query(
        'INSERT INTO fine_blank_inventory (fine_blank_id, quantity_available) VALUES ($1, $2)',
        [fineBlank.id, producedQty]
      );
    } else {
      await client.query(
        'UPDATE fine_blank_inventory SET quantity_available = quantity_available + $1, updated_at = NOW() WHERE fine_blank_id = $2',
        [producedQty, fineBlank.id]
      );
    }
    
    // 5. Log Production
    await client.query(
      `INSERT INTO fine_blank_production_log 
        (cut_piece_id, fine_blank_id, consumed_qty, produced_qty, remarks, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [cutPieceId, fineBlank.id, consumedQty, producedQty, remarks || '', createdBy || 'Operator']
    );

    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `Produced ${producedQty} "${fineBlankName}" from ${consumedQty} cut pieces.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}));

module.exports = router;
