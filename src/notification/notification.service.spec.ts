import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { NotFoundException } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: any;
  let patientRepo: any;

  beforeEach(async () => {
    const mockNotificationRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((notification) => Promise.resolve({ id: 1, ...notification })),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    const mockPatientRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(PatientProfile), useValue: mockPatientRepo },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepo = module.get(getRepositoryToken(Notification));
    patientRepo = module.get(getRepositoryToken(PatientProfile));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyNotifications', () => {
    it('should fetch notifications for a patient successfully', async () => {
      const userId = 1;
      const patientId = 2;
      const mockNotifications = [
        { id: 1, patientId, isRead: false },
        { id: 2, patientId, isRead: true },
      ];

      patientRepo.findOne.mockResolvedValue({ id: patientId, userId });
      notificationRepo.find.mockResolvedValue(mockNotifications);

      const result = await service.getMyNotifications(userId);

      expect(result.message).toBe('Notifications fetched successfully');
      expect(result.count).toBe(2);
      expect(result.notifications).toEqual(mockNotifications);
      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { patientId },
        order: { createdAt: 'DESC' },
      });
    });

    it('should throw NotFoundException if patient profile is not found', async () => {
      const userId = 1;
      patientRepo.findOne.mockResolvedValue(null);

      await expect(service.getMyNotifications(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count successfully', async () => {
      const userId = 1;
      const patientId = 2;

      patientRepo.findOne.mockResolvedValue({ id: patientId, userId });
      notificationRepo.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(userId);

      expect(result.unreadCount).toBe(5);
      expect(notificationRepo.count).toHaveBeenCalledWith({
        where: { patientId, isRead: false },
      });
    });

    it('should return 0 if patient profile is not found', async () => {
      const userId = 1;
      patientRepo.findOne.mockResolvedValue(null);

      const result = await service.getUnreadCount(userId);

      expect(result.unreadCount).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark a specific notification as read successfully', async () => {
      const userId = 1;
      const patientId = 2;
      const notificationId = 1;
      const mockNotification = { id: notificationId, patientId, isRead: false };

      patientRepo.findOne.mockResolvedValue({ id: patientId, userId });
      notificationRepo.findOne.mockResolvedValue(mockNotification);

      const result = await service.markAsRead(notificationId, userId);

      expect(result.message).toBe('Notification marked as read');
      expect(mockNotification.isRead).toBe(true);
      expect(notificationRepo.save).toHaveBeenCalledWith(mockNotification);
    });

    it('should throw NotFoundException if notification is not found or unauthorized', async () => {
      const userId = 1;
      const patientId = 2;
      const notificationId = 1;

      patientRepo.findOne.mockResolvedValue({ id: patientId, userId });
      notificationRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(notificationId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read successfully', async () => {
      const userId = 1;
      const patientId = 2;

      patientRepo.findOne.mockResolvedValue({ id: patientId, userId });
      notificationRepo.update.mockResolvedValue({ affected: 2 });

      const result = await service.markAllAsRead(userId);

      expect(result.message).toBe('All notifications marked as read');
      expect(notificationRepo.update).toHaveBeenCalledWith(
        { patientId, isRead: false },
        { isRead: true },
      );
    });

    it('should throw NotFoundException if patient profile is not found', async () => {
      const userId = 1;
      patientRepo.findOne.mockResolvedValue(null);

      await expect(service.markAllAsRead(userId)).rejects.toThrow(NotFoundException);
    });
  });
});
