const fs = require('fs');
const file = 'src/appointment/appointment.service.spec.ts';
let content = fs.readFileSync(file, 'utf-8');

// Fix 1: bookAppointment
content = content.replace(
  "expect(notificationService.createNotification).toHaveBeenCalledWith(\n        3,\n        NotificationType.APPOINTMENT_BOOKED,\n        'Appointment Booked',\n        expect.stringContaining(\n          'Your appointment with Dr. John Doe has been booked successfully for 24 June at 10:00.',\n        ),\n      );",
  "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_BOOKED,\n        title: 'Appointment Booked',\n        message: expect.stringContaining('Your appointment with Dr. John Doe has been booked successfully for 24 June at 10:00.')\n      }));"
);

// Fix 2: rescheduleAppointment
content = content.replace(
  "expect(notificationService.createNotification).toHaveBeenCalledWith(\n        3,\n        NotificationType.APPOINTMENT_RESCHEDULED,\n        'Appointment Rescheduled',\n        expect.stringContaining(\n          'Your appointment has been rescheduled to 27 June at 14:30.',\n        ),\n      );",
  "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_RESCHEDULED,\n        title: 'Appointment Rescheduled',\n        message: expect.stringContaining('Your appointment has been rescheduled to 27 June at 14:30.')\n      }));"
);

// Fix 3: cancelAppointment
content = content.replace(
  "expect(notificationService.createNotification).toHaveBeenCalledWith(\n        3,\n        NotificationType.APPOINTMENT_CANCELLED,\n        'Appointment Cancelled',\n        expect.stringContaining(\n          'Your appointment scheduled on 24 June at 10:00 has been cancelled.',\n        ),\n      );",
  "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_CANCELLED,\n        title: 'Appointment Cancelled',\n        message: expect.stringContaining('Your appointment scheduled on 24 June at 10:00 has been cancelled.')\n      }));"
);

// Fix 4: cancelAppointmentByDoctor
content = content.replace(
  "expect(notificationService.createNotification).toHaveBeenCalledWith(\n        3,\n        NotificationType.APPOINTMENT_CANCELLED,\n        'Appointment Cancelled',\n        expect.stringContaining('has been cancelled by Dr. Dr. Smith'),\n      );",
  "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_CANCELLED,\n        title: 'Appointment Cancelled',\n        message: expect.stringContaining('has been cancelled by Dr. Dr. Smith')\n      }));"
);

fs.writeFileSync(file, content);
console.log('Fixed file');
