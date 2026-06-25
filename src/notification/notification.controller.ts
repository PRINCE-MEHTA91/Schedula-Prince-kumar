import {
  Controller,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // GET /notifications — Patient views their own notifications (latest first)
  @Get()
  @Roles(Role.PATIENT)
  async getMyNotifications(@Request() req: any) {
    try {
      const userId: number = req.user.id;
      return await this.notificationService.getMyNotifications(userId);
    } catch (error) {
      console.error(error);
      return { statusCode: 500, message: error.message, stack: error.stack };
    }
  }

  // GET /notification/unread-count — Get count of unread notifications
  @Get('unread-count')
  @Roles(Role.PATIENT)
  async getUnreadCount(@Request() req: any) {
    const userId: number = req.user.id;
    return this.notificationService.getUnreadCount(userId);
  }

  // PATCH /notifications/read-all — Mark all notifications as read
  @Patch('read-all')
  @Roles(Role.PATIENT)
  async markAllAsRead(@Request() req: any) {
    const userId: number = req.user.id;
    return this.notificationService.markAllAsRead(userId);
  }

  // PATCH /notifications/:id/read — Mark a specific notification as read
  @Patch(':id/read')
  @Roles(Role.PATIENT)
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const userId: number = req.user.id;
    return this.notificationService.markAsRead(id, userId);
  }
}
