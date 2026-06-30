const fs = require('fs');
const file = 'src/appointment/appointment.service.spec.ts';
let content = fs.readFileSync(file, 'utf-8');

// Use regex to match the pattern: expect(notificationService.createNotification).toHaveBeenCalledWith( [args] );
// We know there are four of them.
content = content.replace(
  /expect\(notificationService\.createNotification\)\.toHaveBeenCalledWith\([\s\S]*?'Appointment Booked',[\s\S]*?Your appointment with Dr\. John Doe has been booked successfully for 24 June at 10:00\.'\s*\),?\s*\);/m,
  "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_BOOKED,\n        title: 'Appointment Booked',\n        message: expect.stringContaining('Your appointment with Dr. John Doe has been booked successfully for 24 June at 10:00.')\n      }));"
);

content = content.replace(
  /expect\(notificationService\.createNotification\)\.toHaveBeenCalledWith\([\s\S]*?'Appointment Rescheduled',[\s\S]*?Your appointment has been rescheduled to 27 June at 14:30\.'\s*\),?\s*\);/m,
  "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_RESCHEDULED,\n        title: 'Appointment Rescheduled',\n        message: expect.stringContaining('Your appointment has been rescheduled to 27 June at 14:30.')\n      }));"
);

content = content.replace(
  /expect\(notificationService\.createNotification\)\.toHaveBeenCalledWith\([\s\S]*?'Appointment Cancelled',[\s\S]*?Your appointment scheduled on 24 June at 10:00 has been cancelled\.'\s*\),?\s*\);/m,
  "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_CANCELLED,\n        title: 'Appointment Cancelled',\n        message: expect.stringContaining('Your appointment scheduled on 24 June at 10:00 has been cancelled.')\n      }));"
);

content = content.replace(
  /expect\(notificationService\.createNotification\)\.toHaveBeenCalledWith\([\s\S]*?'Appointment Cancelled',[\s\S]*?'has been cancelled by Dr\. Dr\. Smith'\s*\),?\s*\);/m,
  "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_CANCELLED,\n        title: 'Appointment Cancelled',\n        message: expect.stringContaining('has been cancelled by Dr. Dr. Smith')\n      }));"
);


fs.writeFileSync(file, content);
console.log('Fixed file');
