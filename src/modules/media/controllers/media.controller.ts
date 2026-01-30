import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MediaService } from '../services/media.service';
import { RequestBatchUploadDto } from '../dto/request-batch-upload.dto';
import { ConfirmUploadDto } from '../dto/confirm-upload.dto';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  BatchUploadRequestResponse,
  ConfirmUploadResponse,
  MediaResponse,
} from '../interfaces/media-response.interface';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload/request')
  @HttpCode(HttpStatus.OK)
  async requestBatchUpload(
    @CurrentUserId() userId: string,
    @Body() dto: RequestBatchUploadDto,
  ): Promise<BatchUploadRequestResponse> {
    return await this.mediaService.requestBatchUpload(userId, dto.items);
  }

  @Post('upload/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmUpload(
    @CurrentUserId() userId: string,
    @Body() dto: ConfirmUploadDto,
  ): Promise<ConfirmUploadResponse> {
    return await this.mediaService.confirmUpload(userId, dto);
  }

  @Get(':id')
  async getMediaById(@Param('id') mediaId: string): Promise<MediaResponse> {
    return await this.mediaService.getMediaById(mediaId);
  }
}
