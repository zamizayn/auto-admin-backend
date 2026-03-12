import type { Request, Response } from 'express';
import { Project } from '../models/Project.js';
import { ScannerService } from '../services/ScannerService.js';
import { SchemaMetadata } from '../models/SchemaMetadata.js';
import { ConnectionService } from '../services/ConnectionService.js';
import { DataTypes } from 'sequelize';

export class ProjectController {
  static async createTable(req: Request, res: Response) {
    const { id } = req.params;
    const { tableName, columns } = req.body;

    try {
      const project = await Project.findByPk(id as any);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const db = await ConnectionService.getExternalDb(project);
      const qi = db.getQueryInterface();

      // Map column types to Sequelize types
      const tableDefinition: any = {};
      columns.forEach((col: any) => {
        let type: any = DataTypes.STRING;
        if (col.type === 'number') type = DataTypes.INTEGER;
        if (col.type === 'date') type = DataTypes.DATE;
        if (col.type === 'boolean') type = DataTypes.BOOLEAN;
        if (col.type === 'text') type = DataTypes.TEXT;

        tableDefinition[col.name] = {
          type,
          allowNull: col.allowNull ?? true,
          primaryKey: col.primaryKey ?? false,
          autoIncrement: col.primaryKey && col.type === 'number',
        };
      });

      await qi.createTable(tableName as string, tableDefinition);
      
      // Rescan project to update metadata
      await ScannerService.scanProject(project);
      
      const schema = await SchemaMetadata.findAll({ where: { projectId: Number(id) } });
      res.status(201).json({ message: 'Table created', schema });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const project = await Project.create(req.body);
      res.status(201).json(project);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const projects = await Project.findAll();
      res.json(projects);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getById(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const project = await Project.findByPk(id as any);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async scan(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    try {
      const project = await Project.findByPk(id as any);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      console.log(`Scan requested for project ${id}:`, {
        name: project.name,
        dbHost: project.dbHost,
        dbPort: project.dbPort,
        dbName: project.dbName,
        dbDialect: project.dbDialect,
      });

      await ScannerService.scanProject(project);
      const schema = await SchemaMetadata.findAll({ where: { projectId: Number(id) } });
      res.json({ message: 'Scan complete', schema });
    } catch (err: any) {
      console.error('Scan endpoint error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }

  static async getSchema(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    try {
      const schema = await SchemaMetadata.findAll({ where: { projectId: Number(id) } });
      res.json(schema);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async delete(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    try {
      const project = await Project.findByPk(id as any);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      await SchemaMetadata.destroy({ where: { projectId: Number(id) } });
      await ConnectionService.clearConnection(Number(id));
      await project.destroy();
      res.json({ message: 'Project deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async dropTable(req: Request, res: Response) {
    const { id, tableName } = req.params;
    try {
      const project = await Project.findByPk(id as any);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const db = await ConnectionService.getExternalDb(project);
      const qi = db.getQueryInterface();

      await qi.dropTable(tableName as string);
      await ScannerService.scanProject(project);

      const schema = await SchemaMetadata.findAll({ where: { projectId: Number(id) } });
      res.json({ message: 'Table dropped successfully', schema });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async alterTable(req: Request, res: Response) {
    const { id, tableName } = req.params;
    const { action, column } = req.body; // action: 'add' | 'remove' | 'changeType'
    try {
      const project = await Project.findByPk(id as any);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const db = await ConnectionService.getExternalDb(project);
      const qi = db.getQueryInterface();

      if (action === 'add') {
        let type: any = DataTypes.STRING;
        if (column.type === 'number') type = DataTypes.INTEGER;
        if (column.type === 'date') type = DataTypes.DATE;
        if (column.type === 'boolean') type = DataTypes.BOOLEAN;
        if (column.type === 'text') type = DataTypes.TEXT;

        await qi.addColumn(tableName as string, column.name as string, {
          type,
          allowNull: column.allowNull ?? true,
        });
      } else if (action === 'remove') {
        await qi.removeColumn(tableName as string, column.name as string);
      } else if (action === 'changeType') {
        let type: any = DataTypes.STRING;
        let postgresCast = 'VARCHAR';
        
        if (column.type === 'number') {
          type = DataTypes.INTEGER;
          postgresCast = 'INTEGER';
        }
        if (column.type === 'date') {
          type = DataTypes.DATE;
          postgresCast = 'TIMESTAMP WITH TIME ZONE';
        }
        if (column.type === 'boolean') {
          type = DataTypes.BOOLEAN;
          postgresCast = 'BOOLEAN';
        }
        if (column.type === 'text') {
          type = DataTypes.TEXT;
          postgresCast = 'TEXT';
        }

        if (project.dbDialect === 'postgres') {
          // For Postgres, we use a raw query to ensure the USING clause is applied correctly
          const quotedTableName = `"${tableName}"`;
          const quotedColumnName = `"${column.name}"`;
          await db.query(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${quotedColumnName} TYPE ${postgresCast} USING ${quotedColumnName}::${postgresCast}`);
        } else {
          await qi.changeColumn(tableName as string, column.name as string, {
            type,
            allowNull: column.allowNull ?? true,
          });
        }
      }

      await ScannerService.scanProject(project);
      const schema = await SchemaMetadata.findAll({ where: { projectId: Number(id) } });
      res.json({ message: `Table altered successfully`, schema });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
