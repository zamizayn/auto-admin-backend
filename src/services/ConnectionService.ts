import { Sequelize } from 'sequelize';
import { Project } from '../models/Project.js';

export class ConnectionService {
  private static connections: Map<number, Sequelize> = new Map();

  static async getExternalDb(project: Project | number) {
    const targetProject = typeof project === 'number'
      ? await Project.findByPk(project)
      : project;

    if (!targetProject) throw new Error('Project not found');
    const projectId = targetProject.id;

    // Return cached connection if available and still active
    if (this.connections.has(projectId)) {
      const cachedDb = this.connections.get(projectId)!;
      try {
        await cachedDb.authenticate();
        return cachedDb;
      } catch (err) {
        console.log(`Cached connection for project ${projectId} is dead, recreating...`);
        this.connections.delete(projectId);
      }
    }

    const isLocal = targetProject.dbHost === 'localhost' ||
      targetProject.dbHost === '127.0.0.1' ||
      targetProject.dbUrl?.includes('localhost') ||
      targetProject.dbUrl?.includes('127.0.0.1');

    let db: Sequelize;

    if (targetProject.dbUrl) {
      let normalizedUrl = targetProject.dbUrl;
      if (normalizedUrl.includes('+')) {
        normalizedUrl = normalizedUrl.replace(/^(postgresql|postgres)\+[^:]+:\/\//, 'postgres://');
      }

      db = new Sequelize(normalizedUrl, {
        logging: false,
        dialectOptions: {
          connectTimeout: 10000,
          ...(isLocal ? {} : {
            ssl: {
              rejectUnauthorized: false,
            }
          }),
        },
        pool: {
          max: 10,
          min: 2,
          acquire: 30000,
          idle: 10000,
        },
      });
    } else {
      db = new Sequelize(
        targetProject.dbName,
        targetProject.dbUser,
        targetProject.dbPass,
        {
          host: targetProject.dbHost,
          port: targetProject.dbPort,
          dialect: targetProject.dbDialect as any,
          logging: false,
          dialectOptions: {
            connectTimeout: 10000,
            ...(isLocal ? {} : {
              ssl: {
                rejectUnauthorized: false,
              }
            }),
          },
          pool: {
            max: 10,
            min: 2,
            acquire: 30000,
            idle: 10000,
          },
        }
      );
    }

    this.connections.set(projectId, db);
    return db;
  }

  static async clearConnection(projectId: number) {
    if (this.connections.has(projectId)) {
      const db = this.connections.get(projectId)!;
      await db.close();
      this.connections.delete(projectId);
    }
  }
}
