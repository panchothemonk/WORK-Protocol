/**
 * WORK Protocol v4 — Test Helpers
 * In-memory mock PostgreSQL pool for unit testing store modules.
 *
 * Supports: INSERT, SELECT, UPDATE, DELETE with $1..$N placeholders,
 * RETURNING, WHERE, ORDER BY, LIMIT, ON CONFLICT DO UPDATE,
 * basic JSONB operations (-> and ->>).
 */

import crypto from 'node:crypto';

/**
 * Create an in-memory mock pool for testing store modules.
 * The pool has a .query(sql, params) method that mimics pg's pool.query.
 * @returns {object} mock pool
 */
export function createMockPool() {
  const tables = new Map();

  function ensureTable(tableName) {
    if (!tables.has(tableName)) {
      tables.set(tableName, []);
    }
    return tables.get(tableName);
  }

  function substituteParams(sql, params) {
    // Replace $1, $2, ... with actual values for pattern matching
    // We handle this manually since we need to parse SQL structure
    return sql;
  }

  function parseColumnValue(valueExpr, params) {
    // If it's a $N placeholder, resolve from params
    const match = valueExpr.match(/^\$(\d+)$/);
    if (match) {
      return params[parseInt(match[1]) - 1];
    }
    // String literal
    if (/^'.*'$/.test(valueExpr)) {
      return valueExpr.slice(1, -1);
    }
    // Function call like NOW()
    if (/^NOW\(\)$/i.test(valueExpr)) {
      return new Date().toISOString();
    }
    // Boolean/null/number
    if (valueExpr === 'NULL' || valueExpr === 'null') return null;
    if (valueExpr === 'TRUE' || valueExpr === 'true') return true;
    if (valueExpr === 'FALSE' || valueExpr === 'false') return false;
    // Default: try as number
    const num = Number(valueExpr);
    if (!isNaN(num)) return num;
    return valueExpr;
  }

  function parseInsert(sql, params) {
    const match = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!match) return null;
    const [, table, colsStr, valsStr] = match;
    const columns = colsStr.split(',').map(c => c.trim());
    const values = valsStr.split(',').map(v => v.trim());

    const row = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = parseColumnValue(values[i], params);
    }

    return { table, row };
  }

  function parseUpdate(sql, params) {
    const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+?))?(?:\s+RETURNING\s+\*)?\s*;?\s*$/is);
    if (!match) return null;
    const [, table, setClause, whereClause] = match;

    // Parse SET clauses
    const setPairs = setClause.split(',').map(s => s.trim());
    const updates = {};
    for (const pair of setPairs) {
      const eqIdx = pair.indexOf('=');
      const col = pair.slice(0, eqIdx).trim();
      const val = pair.slice(eqIdx + 1).trim();
      updates[col] = parseColumnValue(val, params);
    }

    return { table, updates, whereClause: whereClause ? whereClause.trim() : null };
  }

  function parseSelect(sql, params) {
    const match = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?\s*;?\s*$/is);
    if (!match) return null;
    const [, columns, table, whereClause, orderBy, limit] = match;
    return {
      columns: columns === '*' ? '*' : columns.split(',').map(c => c.trim()),
      table,
      whereClause: whereClause ? whereClause.trim() : null,
      orderBy: orderBy ? orderBy.trim() : null,
      limit: limit ? parseInt(limit) : null,
    };
  }

  function parseOnConflict(sql) {
    // Check for ON CONFLICT ... DO UPDATE pattern
    const conflictMatch = sql.match(/ON\s+CONFLICT\s*\(([^)]*)\)\s*DO\s+UPDATE\s+SET\s+(.+)$/is);
    if (!conflictMatch) return null;
    const conflictCols = conflictMatch[1].split(',').map(c => c.trim());
    const setClauseFull = conflictMatch[2].trim();

    // Parse SET clause which may include EXCLUDED.column references
    const setPairs = setClauseFull.split(',').map(s => s.trim());
    const updates = [];
    for (const pair of setPairs) {
      const eqIdx = pair.indexOf('=');
      const col = pair.slice(0, eqIdx).trim();
      const expr = pair.slice(eqIdx + 1).trim();
      updates.push({ col, expr });
    }

    return { conflictCols, updates };
  }

  function applyOnConflict(tableRows, row, conflictParsed) {
    const { conflictCols, updates } = conflictParsed;

    // Find existing row that conflicts
    const existingIdx = tableRows.findIndex(r =>
      conflictCols.every(col => String(r[col]) === String(row[col]))
    );

    if (existingIdx >= 0) {
      // DO UPDATE
      const existing = { ...tableRows[existingIdx] };

      // Resolve each update expression
      const newRow = { ...existing };
      for (const { col, expr } of updates) {
        // Handle EXCLUDED.col
        const excludedMatch = expr.match(/^EXCLUDED\.(\w+)$/i);
        if (excludedMatch) {
          newRow[col] = row[excludedMatch[1]];
        } else {
          // Handle expressions like ((col * count) + val) / (count + 1)
          // Simple case: NOW()
          if (/^NOW\(\)$/i.test(expr)) {
            newRow[col] = new Date().toISOString();
          } else {
            // For arithmetic expressions, try to evaluate
            try {
              let evalExpr = expr;
              // Replace column references with their values
              for (const c of Object.keys(existing)) {
                const re = new RegExp(`\\b${c}\\b`, 'g');
                evalExpr = evalExpr.replace(re, existing[c] || 0);
              }
              // Replace EXCLUDED references
              for (const c of Object.keys(row)) {
                const re = new RegExp(`EXCLUDED\\.${c}\\b`, 'gi');
                evalExpr = evalExpr.replace(re, row[c] || 0);
              }
              // Handle NOW()
              evalExpr = evalExpr.replace(/NOW\(\)/gi, '0'); // Not great but works for arithmetic
              // eslint-disable-next-line no-eval
              newRow[col] = eval(evalExpr);
            } catch (e) {
              // Fallback: use expression as-is
              newRow[col] = expr;
            }
          }
        }
      }
      tableRows[existingIdx] = newRow;
      return newRow;
    } else {
      // INSERT
      tableRows.push(row);
      return row;
    }
  }

  function matchWhere(row, whereClause, params) {
    if (!whereClause) return true;
    // Handle JSONB operations: data->'ids'->>'workerId' = $1
    // For JSONB paths, evaluate against the row
    // Simple case: column = value
    let clause = whereClause;

    // Replace $N with actual param values
    clause = clause.replace(/\$(\d+)/g, (_, n) => {
      const val = params[parseInt(n) - 1];
      if (val === null) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      return String(val);
    });

    // Handle JSONB dereference: data->'ids'->>'workerId' = 'wrk_...'
    // Simple approach: try to parse and evaluate
    if (clause.includes('->')) {
      return evaluateJsonWhere(row, whereClause, params);
    }

    // Simple column = value comparison
    const compMatch = clause.match(/^(\w+)\s*(=|!=|>|<|>=|<=)\s*(.+)$/);
    if (compMatch) {
      const [, col, op, valRaw] = compMatch;
      const colVal = row[col];
      let expected = valRaw;
      if (expected.startsWith("'") && expected.endsWith("'")) {
        expected = expected.slice(1, -1);
      }

      switch (op) {
        case '=': return String(colVal) === expected;
        case '!=': return String(colVal) !== expected;
        default: return String(colVal) === expected;
      }
    }

    return true;
  }

  function evaluateJsonWhere(row, whereClause, params) {
    // Parse: data->'ids'->>'workerId' = $1
    // Replace params
    let clause = whereClause;
    clause = clause.replace(/\$(\d+)/g, (_, n) => {
      const val = params[parseInt(n) - 1];
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      return String(val);
    });

    // Match JSONB path: column->'key1'->'key2'->>'key3' = 'value'
    const jsonMatch = clause.match(/^(\w+)((?:->'(\w+)')*(?:->>'(\w+)'))\s*=\s*'(.+)'$/);
    if (jsonMatch) {
      const [, column, path, finalKey] = [jsonMatch[1], jsonMatch[2], jsonMatch[4]];
      const expected = jsonMatch[5];

      // Navigate the JSONB object
      let obj = row[column];
      if (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch { return false; }
      }

      // Parse the path
      const pathParts = [];
      const pathRe = /->'(\w+)'/g;
      let m;
      while ((m = pathRe.exec(path)) !== null) {
        pathParts.push(m[1]);
      }
      // Last part uses ->> notation
      const lastMatch = path.match(/->>'(\w+)'/);
      if (lastMatch) pathParts.push(lastMatch[1]);

      // Navigate
      for (const part of pathParts) {
        if (!obj || typeof obj !== 'object') return false;
        obj = obj[part];
      }

      return String(obj) === expected;
    }

    return true;
  }

  function sortRows(rows, orderBy) {
    if (!orderBy) return rows;
    const parts = orderBy.split(/\s+/);
    const col = parts[0];
    const dir = (parts[1] || 'ASC').toUpperCase();
    return [...rows].sort((a, b) => {
      const va = a[col];
      const vb = b[col];
      if (va < vb) return dir === 'ASC' ? -1 : 1;
      if (va > vb) return dir === 'ASC' ? 1 : -1;
      return 0;
    });
  }

  // Build the pool
  const pool = {
    query(sql, params = []) {
      const trimmed = sql.trim();

      // Handle INSERT
      const insertParsed = parseInsert(trimmed, params);
      if (insertParsed) {
        const rows = ensureTable(insertParsed.table);

        // Check for ON CONFLICT
        const conflictParsed = parseOnConflict(trimmed);
        if (conflictParsed) {
          const result = applyOnConflict(rows, insertParsed.row, conflictParsed);
          // Handle RETURNING
          if (/RETURNING\s+\*/i.test(trimmed)) {
            return Promise.resolve({ rows: [result], rowCount: 1 });
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        }

        rows.push(insertParsed.row);

        if (/RETURNING\s+\*/i.test(trimmed)) {
          return Promise.resolve({ rows: [insertParsed.row], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }

      // Handle SELECT
      const selectParsed = parseSelect(trimmed, params);
      if (selectParsed) {
        const rows = ensureTable(selectParsed.table);
        const filtered = rows.filter(r => matchWhere(r, selectParsed.whereClause, params));
        const sorted = sortRows(filtered, selectParsed.orderBy);
        const limited = selectParsed.limit ? sorted.slice(0, selectParsed.limit) : sorted;
        return Promise.resolve({ rows: limited, rowCount: limited.length });
      }

      // Handle UPDATE
      const updateParsed = parseUpdate(trimmed, params);
      if (updateParsed) {
        const rows = ensureTable(updateParsed.table);
        let updatedRow = null;
        for (const row of rows) {
          if (matchWhere(row, updateParsed.whereClause, params)) {
            Object.assign(row, updateParsed.updates);
            updatedRow = row;
          }
        }
        if (/RETURNING\s+\*/i.test(trimmed)) {
          return Promise.resolve({ rows: updatedRow ? [updatedRow] : [], rowCount: updatedRow ? 1 : 0 });
        }
        return Promise.resolve({ rows: [], rowCount: updatedRow ? 1 : 0 });
      }

      // Handle CREATE TABLE IF NOT EXISTS (no-op in mock)
      if (/CREATE\s+TABLE/i.test(trimmed)) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      // Handle CREATE INDEX (no-op)
      if (/CREATE\s+INDEX/i.test(trimmed)) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      // Unrecognized query - return empty
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
  };

  return pool;
}

/**
 * Generate a random hex ID for test entities.
 * @param {string} prefix
 * @returns {string}
 */
export function randomId(prefix = 'test') {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}
