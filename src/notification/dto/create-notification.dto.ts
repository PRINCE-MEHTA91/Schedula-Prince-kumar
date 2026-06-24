import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * Internal DTO used by other services (e.g. AppointmentService) to create
 * a notification via NotificationService.createNotification().
 * Not exposed directly via HTTP — it is called programmatically.
 */
export class CreateNotificationDto {
  @IsNotEmpty()
  patientId: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;
}
