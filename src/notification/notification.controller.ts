import {
  Controller,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Param,
  ParseIntPipe,
  Patch,
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
/**
 * All notification endpoints are PATIENT-only.
 * The global JwtAuthGuard + RolesGuard handle authentication.
 */
@Controller('notifications')
@Roles(Role.PATIENT)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /notifications
   * Returns all notifications for the authenticated patient (newest first).
   */
  @Get()
  async getMyNotifications(@Request() req: any) {
    const patientUserId: number = req.user.id;
    return this.notificationService.getMyNotifications(patientUserId);
  }

  /**
   * GET /notifications/unread-count
   * Returns the count of unread notifications.
   * IMPORTANT: This named route MUST come before /:id to avoid route collision.
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const patientUserId: number = req.user.id;
    return this.notificationService.getUnreadCount(patientUserId);
  }

  /**
   * PATCH /notifications/read-all
   * Marks all unread notifications as read.
   * IMPORTANT: This named route MUST come before /:id/read.
   */
  @Patch('read-all')
  async markAllAsRead(@Request() req: any) {
    const patientUserId: number = req.user.id;
    return this.notificationService.markAllAsRead(patientUserId);
  }

  /**
   * PATCH /notifications/:id/read
   * Marks a single notification as read.
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const patientUserId: number = req.user.id;
    return this.notificationService.markAsRead(id, patientUserId);
  }
}
