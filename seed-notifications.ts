import { AppDataSource } from './src/data-source';
import { Notification } from './src/notification/entities/notification.entity';
import { PatientProfile } from './src/patient/entities/patient-profile.entity';
import { NotificationType } from './src/notification/enums/notification-type.enum';

async function seed() {
  await AppDataSource.initialize();
  const patientRepo = AppDataSource.getRepository(PatientProfile);
  const notificationRepo = AppDataSource.getRepository(Notification);

  const patients = await patientRepo.find();
  if (patients.length === 0) {
    console.log('No patients found. Please create a patient first in Postman.');
    process.exit(1);
  }

  for (const patient of patients) {
    const notif1 = notificationRepo.create({
      patientId: patient.id,
      title: 'Appointment Booked',
      message: 'Your upcoming appointment has been confirmed.',
      type: NotificationType.APPOINTMENT_BOOKED,
      isRead: false,
    });
    const notif2 = notificationRepo.create({
      patientId: patient.id,
      title: 'Health Check Reminder',
      message: 'Please complete your pre-consultation form.',
      type: NotificationType.FOLLOW_UP_REMINDER,
      isRead: false,
    });
    
    await notificationRepo.save([notif1, notif2]);
    console.log(`Successfully added 2 unread notifications for Patient ID: ${patient.id}`);
  }

  console.log('\nDone! You can now check Postman.');
  process.exit(0);
}

seed().catch(console.error);
