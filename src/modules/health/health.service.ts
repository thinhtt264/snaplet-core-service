import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

export interface DatabaseHealthResponse {
  status: string;
  database: string;
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  check(): HealthCheckResponse {
    try {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Health check failed');
    }
  }

  checkDatabase(): DatabaseHealthResponse {
    try {
      const dbState = this.connection.readyState;
      const states: Record<number, string> = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
      };

      const dbHealthData = {
        status: Number(dbState) === 1 ? 'ok' : 'error',
        database: states[dbState] || 'unknown',
        timestamp: new Date().toISOString(),
      };

      if (Number(dbState) === 1) {
        return dbHealthData;
      } else {
        this.logger.warn(`Database is not connected: ${states[dbState]}`);
        throw new ServiceUnavailableException('Database is not connected');
      }
    } catch (error) {
      this.logger.error(`Database check failed: ${error.message}`, error.stack);
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new InternalServerErrorException('Database check failed');
    }
  }
}
