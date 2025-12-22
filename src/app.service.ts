import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  getHello(): { message: string } {
    try {
      return { message: 'Hello World!' };
    } catch (error) {
      this.logger.error(`Failed to get hello: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Internal server error');
    }
  }
}
