/**
 * test-api.js — Appointment Booking API Tests
 * Run: node test-api.js
 * Make sure server is running: npm run start:dev
 */

const BASE_URL = 'http://localhost:3000';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function log(label, status, data) {
  const icon = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚠️';
  console.log(`\n${icon} [${status}] ${label}`);
  console.log(JSON.stringify(data, null, 2));
}

// ── Test Runner ──────────────────────────────────────────────────────────────

async function runTests() {
  console.log('='.repeat(60));
  console.log('  Appointment Booking API Tests');
  console.log('='.repeat(60));

  let patientToken = '';
  let doctorToken = '';
  let appointmentId = null;
  let doctorProfileId = null;

  // ─── Step 1: Sign up a patient ─────────────────────────────────────────────
  console.log('\n📋 STEP 1: Create Patient Account');
  const patientSignup = await request('POST', '/auth/signup', {
    name: 'Test Patient',
    email: `patient_${Date.now()}@test.com`,
    password: 'patient123',
    role: 'PATIENT',
  });
  log('Patient signup', patientSignup.status, patientSignup.data);

  // ─── Step 2: Log in as patient ──────────────────────────────────────────────
  console.log('\n📋 STEP 2: Login as Patient');
  const patientLogin = await request('POST', '/auth/login', {
    email: patientSignup.data.user?.email,
    password: 'patient123',
  });
  patientToken = patientLogin.data.access_token;
  log('Patient login', patientLogin.status, { token: patientToken ? 'received' : 'missing' });

  // ─── Step 3: Create patient profile ────────────────────────────────────────
  console.log('\n📋 STEP 3: Create Patient Profile');
  const patientProfile = await request(
    'POST',
    '/patient/profile',
    {
      fullName: 'Test Patient',
      age: 25,
      gender: 'MALE',
      contactDetails: '9876543210',
      basicHealthInfo: 'No major issues',
    },
    patientToken,
  );
  log('Create patient profile', patientProfile.status, patientProfile.data);

  // ─── Step 4: Sign up a doctor ──────────────────────────────────────────────
  console.log('\n📋 STEP 4: Create Doctor Account');
  const doctorEmail = `doctor_${Date.now()}@test.com`;
  const doctorSignup = await request('POST', '/auth/signup', {
    name: 'Dr. Test',
    email: doctorEmail,
    password: 'doctor123',
    role: 'DOCTOR',
  });
  log('Doctor signup', doctorSignup.status, doctorSignup.data);

  // ─── Step 5: Log in as doctor ──────────────────────────────────────────────
  console.log('\n📋 STEP 5: Login as Doctor');
  const doctorLogin = await request('POST', '/auth/login', {
    email: doctorEmail,
    password: 'doctor123',
  });
  doctorToken = doctorLogin.data.access_token;
  log('Doctor login', doctorLogin.status, { token: doctorToken ? 'received' : 'missing' });

  // ─── Step 6: Create doctor profile ─────────────────────────────────────────
  console.log('\n📋 STEP 6: Create Doctor Profile');
  const doctorProfile = await request(
    'POST',
    '/doctor/profile',
    {
      fullName: 'Dr. Test Kumar',
      specialization: 'Cardiologist',
      experience: 10,
      qualification: 'MBBS, MD',
      consultationFee: 500,
      availabilityHours: '09:00-17:00',
      profileDetails: 'Heart specialist',
    },
    doctorToken,
  );
  log('Create doctor profile', doctorProfile.status, doctorProfile.data);
  doctorProfileId = doctorProfile.data.profile?.id;
  console.log('→ Doctor Profile ID:', doctorProfileId);

  if (!doctorProfileId) {
    console.log('\n⚠️  Could not get doctorProfileId — some tests will fail');
  }

  // ─── Step 7: Get available doctors (patient sees doctor list) ──────────────
  console.log('\n📋 STEP 7: Patient browses doctors');
  const doctors = await request('GET', '/doctor', null, patientToken);
  log('Get all doctors', doctors.status, { count: doctors.data.doctors?.length });

  // Use first doctor if we didn't get doctorProfileId above
  if (!doctorProfileId && doctors.data.doctors?.length > 0) {
    doctorProfileId = doctors.data.doctors[0].id;
    console.log('→ Using Doctor Profile ID:', doctorProfileId);
  }

  // ─── Step 8: BOOK an appointment (happy path) ───────────────────────────────
  console.log('\n📋 STEP 8: Book Appointment (should succeed)');
  const bookRes = await request(
    'POST',
    '/appointment',
    {
      doctorId: doctorProfileId,
      date: '2026-12-20',
      startTime: '10:00',
      endTime: '10:15',
    },
    patientToken,
  );
  log('Book appointment', bookRes.status, bookRes.data);
  appointmentId = bookRes.data.appointment?.id;
  console.log('→ Appointment ID:', appointmentId);

  // ─── Step 9: DUPLICATE booking — same slot (should fail with 409) ──────────
  console.log('\n📋 STEP 9: Duplicate booking (should fail 409)');
  const dupRes = await request(
    'POST',
    '/appointment',
    {
      doctorId: doctorProfileId,
      date: '2026-12-20',
      startTime: '10:00',
      endTime: '10:15',
    },
    patientToken,
  );
  log('Duplicate booking', dupRes.status, dupRes.data);

  // ─── Step 10: Past date booking (should fail with 400) ─────────────────────
  console.log('\n📋 STEP 10: Past date booking (should fail 400)');
  const pastRes = await request(
    'POST',
    '/appointment',
    {
      doctorId: doctorProfileId,
      date: '2020-01-01',
      startTime: '10:00',
      endTime: '10:15',
    },
    patientToken,
  );
  log('Past date booking', pastRes.status, pastRes.data);

  // ─── Step 11: Doctor tries to book (should fail with 403) ──────────────────
  console.log('\n📋 STEP 11: Doctor tries to book (should fail 403)');
  const wrongRoleRes = await request(
    'POST',
    '/appointment',
    {
      doctorId: doctorProfileId,
      date: '2026-12-20',
      startTime: '11:00',
      endTime: '11:15',
    },
    doctorToken,
  );
  log('Doctor booking (wrong role)', wrongRoleRes.status, wrongRoleRes.data);

  // ─── Step 12: Non-existent doctor (should fail with 404) ──────────────────
  console.log('\n📋 STEP 12: Book with invalid doctorId (should fail 404)');
  const noDoctorRes = await request(
    'POST',
    '/appointment',
    {
      doctorId: 99999,
      date: '2026-12-20',
      startTime: '10:00',
      endTime: '10:15',
    },
    patientToken,
  );
  log('Invalid doctorId booking', noDoctorRes.status, noDoctorRes.data);

  // ─── Step 13: Patient views their appointments ──────────────────────────────
  console.log('\n📋 STEP 13: Patient views their appointments');
  const myAppts = await request('GET', '/appointment/my', null, patientToken);
  log('GET /appointment/my', myAppts.status, myAppts.data);

  // ─── Step 14: Doctor views their appointments ───────────────────────────────
  console.log('\n📋 STEP 14: Doctor views their appointments');
  const doctorAppts = await request('GET', '/doctor/appointments', null, doctorToken);
  log('GET /doctor/appointments', doctorAppts.status, doctorAppts.data);

  // ─── Step 15: Cancel appointment ────────────────────────────────────────────
  if (appointmentId) {
    console.log('\n📋 STEP 15: Cancel appointment (should succeed)');
    const cancelRes = await request(
      'PATCH',
      `/appointment/${appointmentId}/cancel`,
      null,
      patientToken,
    );
    log(`PATCH /appointment/${appointmentId}/cancel`, cancelRes.status, cancelRes.data);

    // ─── Step 16: Cancel already cancelled (should fail 400) ──────────────────
    console.log('\n📋 STEP 16: Cancel again (should fail 400)');
    const cancelAgainRes = await request(
      'PATCH',
      `/appointment/${appointmentId}/cancel`,
      null,
      patientToken,
    );
    log('Cancel already cancelled', cancelAgainRes.status, cancelAgainRes.data);
  }

  // ─── Step 17: Invalid appointment ID ────────────────────────────────────────
  console.log('\n📋 STEP 17: Cancel invalid appointment ID (should fail 404)');
  const invalidIdRes = await request(
    'PATCH',
    '/appointment/99999/cancel',
    null,
    patientToken,
  );
  log('Cancel invalid ID', invalidIdRes.status, invalidIdRes.data);

  // ─── Step 18: Patient tries to access doctor route (should fail 403) ───────
  console.log('\n📋 STEP 18: Patient accesses doctor route (should fail 403)');
  const wrongRouteRes = await request('GET', '/doctor/appointments', null, patientToken);
  log('Patient on doctor route', wrongRouteRes.status, wrongRouteRes.data);

  console.log('\n' + '='.repeat(60));
  console.log('  All tests completed!');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
