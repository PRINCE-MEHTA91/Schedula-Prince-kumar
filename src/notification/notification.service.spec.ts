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
/**
 * Unit Tests: NotificationService
 * Day 14 — Notification System Foundation
 *
 * Scenarios covered:
 *  getMyNotifications
 *    1.  Returns notifications list (newest-first)
 *    2.  Returns empty message when patient has no notifications
 *    3.  Throws NotFoundException when patient profile not found
 *
 *  markAsRead
 *    4.  Marks an unread notification as read
 *    5.  Returns early when notification already read
 *    6.  Throws NotFoundException for unknown notification ID
 *    7.  Throws ForbiddenException for another patient's notification
 *    8.  Throws NotFoundException when patient profile not found
 *
 *  markAllAsRead
 *    9.  Updates all unread notifications and returns affected count
 *    10. Returns "no unread" message when nothing to update
 *    11. Throws NotFoundException when patient profile not found
 *
 *  getUnreadCount
 *    12. Returns correct unread count
 *    13. Returns 0 when all notifications are read
 *    14. Throws NotFoundException when patient profile not found
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { NotificationType } from './enums/notification-type.enum';

// ─── Mock factory ─────────────────────────────────────────────────────────────
const mockNotificationRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockPatientRepo = () => ({
  findOne: jest.fn(),
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const patient: Partial<PatientProfile> = { id: 10, userId: 99 };

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    patientId: 10,
    title: 'Appointment Booked',
    message: 'Your appointment has been confirmed.',
    type: NotificationType.APPOINTMENT_BOOKED,
    isRead: false,
    createdAt: new Date(),
    patient: null as any,
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('NotificationService', () => {
  let service: NotificationService;
  let notifRepo: ReturnType<typeof mockNotificationRepo>;
  let patientRepo: ReturnType<typeof mockPatientRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useFactory: mockNotificationRepo },
        { provide: getRepositoryToken(PatientProfile), useFactory: mockPatientRepo },
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
    notifRepo = module.get(getRepositoryToken(Notification));
    patientRepo = module.get(getRepositoryToken(PatientProfile));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getMyNotifications ────────────────────────────────────────────────────

  describe('getMyNotifications', () => {
    it('Scenario 1 — returns notifications ordered newest-first', async () => {
      const notifications = [
        makeNotification({ id: 2, isRead: true }),
        makeNotification({ id: 1, isRead: false }),
      ];
      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.find.mockResolvedValue(notifications);

      const result = await service.getMyNotifications(99);

      expect(patientRepo.findOne).toHaveBeenCalledWith({ where: { userId: 99 } });
      expect(notifRepo.find).toHaveBeenCalledWith({
        where: { patientId: 10 },
        order: { createdAt: 'DESC' },
      });
      expect(result.notifications).toHaveLength(2);
      expect(result.message).toContain('fetched');
    });

    it('Scenario 2 — returns empty message when no notifications exist', async () => {
      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.find.mockResolvedValue([]);

      const result = await service.getMyNotifications(99);

      expect(result.notifications).toHaveLength(0);
      expect(result.message).toContain('no notifications');
    });

    it('Scenario 3 — throws NotFoundException when patient profile not found', async () => {
      patientRepo.findOne.mockResolvedValue(null);

      await expect(service.getMyNotifications(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── markAsRead ───────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('Scenario 4 — marks unread notification as read', async () => {
      const notif = makeNotification({ isRead: false });
      const updated = { ...notif, isRead: true };

      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.findOne.mockResolvedValue(notif);
      notifRepo.save.mockResolvedValue(updated);

      const result = await service.markAsRead(1, 99);

      expect(notifRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isRead: true }));
      expect(result.notification.isRead).toBe(true);
      expect(result.message).toContain('marked as read');
    });

    it('Scenario 5 — returns early without saving when already read', async () => {
      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.findOne.mockResolvedValue(makeNotification({ isRead: true }));

      const result = await service.markAsRead(1, 99);

      expect(notifRepo.save).not.toHaveBeenCalled();
      expect(result.message).toContain('already marked as read');
    });

    it('Scenario 6 — throws NotFoundException for unknown notification ID', async () => {
      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(9999, 99)).rejects.toThrow(NotFoundException);
    });

    it('Scenario 7 — throws ForbiddenException for another patient\'s notification', async () => {
      patientRepo.findOne.mockResolvedValue(patient);
      // Notification belongs to patient 20, not 10
      notifRepo.findOne.mockResolvedValue(makeNotification({ patientId: 20 }));

      await expect(service.markAsRead(1, 99)).rejects.toThrow(ForbiddenException);
    });

    it('Scenario 8 — throws NotFoundException when patient profile not found', async () => {
      patientRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(1, 99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('Scenario 9 — updates all unread and returns affected count', async () => {
      patientRepo.findOne.mockResolvedValue(patient);

      // Mock createQueryBuilder chain
      const executeMock = jest.fn().mockResolvedValue({ affected: 3 });
      const whereMock = jest.fn().mockReturnValue({ execute: executeMock });
      const setMock = jest.fn().mockReturnValue({ where: whereMock });
      const updateMock = jest.fn().mockReturnValue({ set: setMock });
      notifRepo.createQueryBuilder.mockReturnValue({ update: updateMock });

      const result = await service.markAllAsRead(99);

      expect(result.updatedCount).toBe(3);
      expect(result.message).toContain('3 notification(s)');
    });

    it('Scenario 10 — returns "no unread" message when nothing to update', async () => {
      patientRepo.findOne.mockResolvedValue(patient);

      const executeMock = jest.fn().mockResolvedValue({ affected: 0 });
      const whereMock = jest.fn().mockReturnValue({ execute: executeMock });
      const setMock = jest.fn().mockReturnValue({ where: whereMock });
      const updateMock = jest.fn().mockReturnValue({ set: setMock });
      notifRepo.createQueryBuilder.mockReturnValue({ update: updateMock });

      const result = await service.markAllAsRead(99);

      expect(result.updatedCount).toBe(0);
      expect(result.message).toContain('No unread notifications');
    });

    it('Scenario 11 — throws NotFoundException when patient profile not found', async () => {
      patientRepo.findOne.mockResolvedValue(null);

      await expect(service.markAllAsRead(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getUnreadCount ───────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('Scenario 12 — returns correct unread count', async () => {
      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(99);

      expect(notifRepo.count).toHaveBeenCalledWith({
        where: { patientId: 10, isRead: false },
      });
      expect(result.unreadCount).toBe(5);
    });

    it('Scenario 13 — returns 0 when all notifications are read', async () => {
      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(99);

      expect(result.unreadCount).toBe(0);
    });

    it('Scenario 14 — throws NotFoundException when patient profile not found', async () => {
      patientRepo.findOne.mockResolvedValue(null);

      await expect(service.getUnreadCount(99)).rejects.toThrow(NotFoundException);
    });
  });
});
