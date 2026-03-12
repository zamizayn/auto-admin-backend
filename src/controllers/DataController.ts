import type { Request, Response } from 'express';
import { Sequelize } from 'sequelize';
import { Project } from '../models/Project.js';
import { ConnectionService } from '../services/ConnectionService.js';

export class DataController {
  static async list(req: Request, res: Response) {
    const { projectId, table } = req.params;
    const { filters, page = 1, limit = 20 } = req.query;
    const db = await ConnectionService.getExternalDb(Number(projectId));
    try {
      const qi = db.getQueryInterface();
      const quotedTable = qi.quoteIdentifier(table as string);
      let whereClause = '';
      if (filters) {
        const parsedFilters = JSON.parse(filters as string);
        const conditions = Object.entries(parsedFilters).map(([column, filter]: [string, any]) => {
          const quotedColumn = qi.quoteIdentifier(column);
          const { operator, value } = filter;

          if (operator === 'contains') {
            const escapedValue = String(value).replace(/'/g, "''");
            return `${quotedColumn} ILIKE '%${escapedValue}%'`;
          } else if (operator === 'equals') {
            const formattedValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value;
            return `${quotedColumn} = ${formattedValue}`;
          } else if (operator === 'gt') {
            const formattedValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value;
            return `${quotedColumn} > ${formattedValue}`;
          } else if (operator === 'lt') {
            const formattedValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value;
            return `${quotedColumn} < ${formattedValue}`;
          }
          return null;
        }).filter(Boolean);

        if (conditions.length > 0) {
          whereClause = `WHERE ${conditions.join(' AND ')}`;
        }
      }

      const offset = (Number(page) - 1) * Number(limit);

      // Get total count for pagination
      const [countResult]: any = await db.query(`SELECT COUNT(*) as count FROM ${quotedTable} ${whereClause}`);
      const total = parseInt(countResult[0].count);

      const [results] = await db.query(`SELECT * FROM ${quotedTable} ${whereClause} LIMIT ${Number(limit)} OFFSET ${offset}`);

      res.json({
        data: results,
        total,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async create(req: Request, res: Response) {
    const { projectId, table } = req.params;
    const db = await ConnectionService.getExternalDb(Number(projectId));
    try {
      const data = { ...req.body };
      delete data.id; // Don't try to insert explicit ID if it's auto-generated

      const qi = db.getQueryInterface();
      const quotedTable = qi.quoteIdentifier(table as string);
      const keys = Object.keys(data).map(k => qi.quoteIdentifier(k)).join(', ');
      const values = Object.values(data).map(v => 
        v === null ? 'NULL' : (typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v)
      ).join(', ');
      await db.query(`INSERT INTO ${quotedTable} (${keys}) VALUES (${values})`);
      res.status(201).json({ message: 'Created' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async update(req: Request, res: Response) {
    const { projectId, table, id } = req.params;
    const db = await ConnectionService.getExternalDb(Number(projectId));
    try {
      const qi = db.getQueryInterface();
      const quotedTable = qi.quoteIdentifier(table as string);

      // Detect PK
      const describe: any = await qi.describeTable(table as string);
      const pkCol = Object.keys(describe).find(c => describe[c].primaryKey) || 'id';
      const quotedPk = qi.quoteIdentifier(pkCol);
      const formattedPkValue = typeof id === 'string' ? `'${id.replace(/'/g, "''")}'` : id;

      const updates = Object.entries(req.body)
        .filter(([k]) => k !== pkCol) // Cannot update identity column
        .map(([k, v]) => {
          const formattedVal = v === null ? 'NULL' : (typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v);
          return `${qi.quoteIdentifier(k)} = ${formattedVal}`;
        })
        .join(', ');

      if (!updates) return res.json({ message: 'No changes' });

      await db.query(`UPDATE ${quotedTable} SET ${updates} WHERE ${quotedPk} = ${formattedPkValue}`);
      res.json({ message: 'Updated' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async delete(req: Request, res: Response) {
    const { projectId, table, id } = req.params;
    const db = await ConnectionService.getExternalDb(Number(projectId));
    try {
      const qi = db.getQueryInterface();
      const quotedTable = qi.quoteIdentifier(table as string);
      
      const describe: any = await qi.describeTable(table as string);
      const pkCol = Object.keys(describe).find(c => describe[c].primaryKey) || 'id';
      const quotedPk = qi.quoteIdentifier(pkCol);
      const formattedPkValue = typeof id === 'string' ? `'${id.replace(/'/g, "''")}'` : id;

      await db.query(`DELETE FROM ${quotedTable} WHERE ${quotedPk} = ${formattedPkValue}`);
      res.json({ message: 'Deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async lookup(req: Request, res: Response) {
    const { projectId, table } = req.params;
    const { search } = req.query;
    const db = await ConnectionService.getExternalDb(Number(projectId));
    try {
      const qi = db.getQueryInterface();
      const quotedTable = qi.quoteIdentifier(table as string);

      const describe = await qi.describeTable(table as string);
      const cols = Object.keys(describe);

      // Heuristic to find a "label" column
      const labelCol = cols.find(c =>
        ['name', 'title', 'username', 'email', 'label', 'display_name', 'full_name'].includes(c.toLowerCase())
      ) || cols[0];

      const pkCol = cols.find(c => describe[c]?.primaryKey) || 'id';
      const quotedLabel = qi.quoteIdentifier(labelCol as string);
      const quotedId = qi.quoteIdentifier(pkCol as string);

      let where = '';
      if (search) {
        const escapedSearch = String(search).replace(/'/g, "''");
        where = `WHERE ${quotedLabel} ILIKE '%${escapedSearch}%' OR CAST(${quotedId} AS TEXT) ILIKE '%${escapedSearch}%'`;
      }

      const [results] = await db.query(`
        SELECT ${quotedId} as id, ${quotedLabel} as label 
        FROM ${quotedTable} 
        ${where} 
        ORDER BY ${quotedLabel} ASC 
        LIMIT 50
      `);

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async executeQuery(req: Request, res: Response) {
    const { projectId } = req.params;
    const { sql } = req.body;
    const db = await ConnectionService.getExternalDb(Number(projectId));
    try {
      const trimmedSql = sql.trim().toLowerCase();

      // Strict Read-Only Check
      if (!trimmedSql.startsWith('select')) {
        return res.status(403).json({ error: 'Only SELECT queries are allowed for security reasons.' });
      }

      const forbidden = ['drop', 'delete', 'update', 'insert', 'alter', 'truncate', 'create', 'grant', 'revoke'];
      if (forbidden.some(word => trimmedSql.includes(word))) {
        return res.status(403).json({ error: 'Data modification queries are not allowed in the SQL Console.' });
      }

      const [results, metadata] = await db.query(sql);
      res.json({ results, metadata });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
