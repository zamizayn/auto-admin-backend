import { Sequelize, QueryInterface } from 'sequelize';
import { Project } from '../models/Project.js';
import { SchemaMetadata } from '../models/SchemaMetadata.js';
import { ConnectionService } from './ConnectionService.js';

export class ScannerService {
  static async scanProject(project: Project) {
    console.log(`Scanning project "${project.name}" - connecting to ${project.dbDialect}://${project.dbHost}:${project.dbPort}/${project.dbName}`);

    const targetSequelize = await ConnectionService.getExternalDb(project);

    try {
      console.log('Authenticating to target database...');
      await targetSequelize.authenticate();
      console.log('Connected! Fetching tables...');
      
      // Clear existing metadata for this project to prevent duplicates/stale data
      await SchemaMetadata.destroy({ where: { projectId: project.id } });
      console.log('Cleared existing metadata...');

      const queryInterface = targetSequelize.getQueryInterface();
      const tables = await queryInterface.showAllTables();
      console.log(`Found ${tables.length} tables:`, tables);

      for (const tableName of tables) {
        if (typeof tableName !== 'string') continue;
        console.log(`  Scanning table: ${tableName}`);
        
        const describe = await queryInterface.describeTable(tableName);
        const fks = (await queryInterface.getForeignKeyReferencesForTable(tableName)) as any[];
        
        const fields = Object.keys(describe).map(colName => {
          const col = describe[colName];
          if (!col) return null;
          
          const fk = fks.find((f: any) => f.columnName === colName);
          
          return {
            name: colName,
            type: this.mapDataType(col.type),
            allowNull: col.allowNull,
            primaryKey: col.primaryKey,
            defaultValue: col.defaultValue,
            relation: fk ? {
              referencedTable: fk.referencedTableName,
              referencedColumn: fk.referencedColumnName
            } : undefined
          };
        }).filter(f => f !== null) as any[];

        await SchemaMetadata.upsert({
          projectId: project.id,
          tableName,
          fields,
        });
        console.log(`  ✓ ${tableName}: ${fields.length} columns (${fks.length} relations)`);
      }

      console.log('Scan complete!');
    } catch (err) {
      console.error('Scanner error:', err);
      throw err;
    } finally {
      await targetSequelize.close();
    }
  }

  private static mapDataType(dbType: string): string {
    const type = dbType.toLowerCase();
    if (type.includes('int') || type.includes('decimal') || type.includes('float') || type.includes('double')) return 'number';
    if (type.includes('date') || type.includes('timestamp')) return 'date';
    if (type.includes('bool') || type.includes('tinyint(1)')) return 'boolean';
    return 'string'; // Default
  }
}

