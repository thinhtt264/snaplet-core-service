import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import type {
  HealthCheckResponse,
  DatabaseHealthResponse,
} from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthCheckResponse {
    return this.healthService.check();
  }

  @Get('db')
  checkDatabase(): DatabaseHealthResponse {
    return this.healthService.checkDatabase();
  }
}
