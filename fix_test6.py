import os
file_path = 'src/appointment/appointment.service.spec.ts'

with open(file_path, 'r') as f:
    content = f.read()

import re

# Match the calls
content = re.sub(
    r"expect\(notificationService\.createNotification\)\.toHaveBeenCalledWith\(\s*3,\s*NotificationType\.APPOINTMENT_BOOKED,\s*'Appointment Booked',\s*expect\.stringContaining\(\s*'Your appointment with Dr\. John Doe has been booked successfully for 24 June at 10:00\.',\s*\),\s*\);",
    "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_BOOKED,\n        title: 'Appointment Booked',\n        message: expect.stringContaining('Your appointment with Dr. John Doe has been booked successfully for 24 June at 10:00.')\n      }));",
    content
)

content = re.sub(
    r"expect\(notificationService\.createNotification\)\.toHaveBeenCalledWith\(\s*3,\s*NotificationType\.APPOINTMENT_RESCHEDULED,\s*'Appointment Rescheduled',\s*expect\.stringContaining\(\s*'Your appointment has been rescheduled to 27 June at 14:30\.',\s*\),\s*\);",
    "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_RESCHEDULED,\n        title: 'Appointment Rescheduled',\n        message: expect.stringContaining('Your appointment has been rescheduled to 27 June at 14:30.')\n      }));",
    content
)

content = re.sub(
    r"expect\(notificationService\.createNotification\)\.toHaveBeenCalledWith\(\s*3,\s*NotificationType\.APPOINTMENT_CANCELLED,\s*'Appointment Cancelled',\s*expect\.stringContaining\(\s*'Your appointment scheduled on 24 June at 10:00 has been cancelled\.',\s*\),\s*\);",
    "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_CANCELLED,\n        title: 'Appointment Cancelled',\n        message: expect.stringContaining('Your appointment scheduled on 24 June at 10:00 has been cancelled.')\n      }));",
    content
)

content = re.sub(
    r"expect\(notificationService\.createNotification\)\.toHaveBeenCalledWith\(\s*3,\s*NotificationType\.APPOINTMENT_CANCELLED,\s*'Appointment Cancelled',\s*expect\.stringContaining\('has been cancelled by Dr\. Dr\. Smith'\),\s*\);",
    "expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({\n        patientId: 3,\n        type: NotificationType.APPOINTMENT_CANCELLED,\n        title: 'Appointment Cancelled',\n        message: expect.stringContaining('has been cancelled by Dr. Dr. Smith')\n      }));",
    content
)

with open(file_path, 'w') as f:
    f.write(content)

print('Fixed file')
