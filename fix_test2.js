const fs = require('fs');

const file = 'src/appointment/appointment.service.spec.ts';
let content = fs.readFileSync(file, 'utf-8');

// Fix 1: Add jest.clearAllMocks() to beforeEach
content = content.replace('beforeEach(async () => {', 'beforeEach(async () => {\n    jest.clearAllMocks();');

// Fix 2: Rename cancelDoctorAppointment to cancelAppointmentByDoctor
content = content.replace(/cancelDoctorAppointment/g, 'cancelAppointmentByDoctor');

// Fix 3: Change 'Stream' to 'STREAM'
content = content.replace(/toBe\('Stream'\)/g, "toBe('STREAM')");

// Fix 4: Fix the mock call arguments in getDoctorAppointments test (remove status: AppointmentStatus.CONFIRMED)
content = content.replace(/where: \{ doctorId: 1, status: AppointmentStatus\.CONFIRMED \}/g, 'where: { doctorId: 1 }');
content = content.replace(/where: \{ doctorId: 1, status: AppointmentStatus\.CONFIRMED, date: '2026-06-25' \}/g, "where: { doctorId: 1, date: '2026-06-25' }");

// Fix 5: Add relations: { patient: true } to the mockAppointmentRepo.findOne mock in cancelAppointmentByDoctor
content = content.replace(/expect\(mockAppointmentRepo\.findOne\)\.toHaveBeenCalledWith\(\{ where: \{ id: 1 \} \}\);/g, "expect(mockAppointmentRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 }, relations: { patient: true } });");

fs.writeFileSync(file, content);
console.log('Fixed file');
