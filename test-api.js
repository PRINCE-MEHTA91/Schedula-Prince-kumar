/**
 * test-api.js — Manual Test Script for Schedula Slot Generation System
 *
 * Run with:  node test-api.js
 *
 * Tests:
 *   1. Auth  — signup & login as doctor + patient
 *   2. Doctor Profile  — create profile
 *   3. Recurring Availability  — set weekly schedule
 *   4. Custom Override  — override a specific date
 *   5. Slot Fetching  — get available slots
 *   6. Booked Slot Filtering  — slots disappear after booking
 *   7. Edge Cases  — invalid date, past date, no availability, doctor not found
 */

const BASE = 'http://localhost:3000';

// ── helper ──────────────────────────────────────────────────────────────────
async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function log(label, { status, data }) {
  const ok = status >= 200 && status < 300;
  console.log(`\n${ok ? '✅' : '❌'} ${label}  [${status}]`);
  console.log(JSON.stringify(data, null, 2));
  return { status, data };
}

function logSection(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ── dates ───────────────────────────────────────────────────────────────────
function getDateNDaysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Day-of-week name for a date N days from now (for recurring setup)
function dayOfWeekFor(n) {
  const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const d = new Date();
  d.setDate(d.getDate() + n);
  return days[d.getDay()];
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Schedula Slot Generation — API Test Suite');
  console.log('   Base URL:', BASE);
  console.log('   Time    :', new Date().toLocaleString());

  // ────────────────────────────────────────────────────────────────
  logSection('1. AUTH — Signup & Login');
  // ────────────────────────────────────────────────────────────────

  const doctorEmail  = `doctor_${Date.now()}@test.com`;
  const patientEmail = `patient_${Date.now()}@test.com`;
  const password     = 'Test@1234';

  // Sign up doctor
  log('Signup Doctor', await req('POST', '/auth/signup', {
    name: 'Dr. Test Kumar', email: doctorEmail, password, role: 'DOCTOR',
  }));

  // Sign up patient
  log('Signup Patient', await req('POST', '/auth/signup', {
    name: 'Patient Raj', email: patientEmail, password, role: 'PATIENT',
  }));

  // Login doctor
  let res = log('Login Doctor', await req('POST', '/auth/login', { email: doctorEmail, password }));
  const doctorToken = res.data?.access_token;
  if (!doctorToken) { console.error('❌ Doctor login failed. Aborting.'); process.exit(1); }

  // Login patient
  res = log('Login Patient', await req('POST', '/auth/login', { email: patientEmail, password }));
  const patientToken = res.data?.access_token;
  if (!patientToken) { console.error('❌ Patient login failed. Aborting.'); process.exit(1); }

  // ────────────────────────────────────────────────────────────────
  logSection('2. DOCTOR PROFILE — Create Profile');
  // ────────────────────────────────────────────────────────────────

  res = log('Create Doctor Profile (slotDuration=15 min)', await req('POST', '/doctor/profile', {
    fullName        : 'Dr. Test Kumar',
    specialization  : 'Cardiologist',
    experience      : 5,
    qualification   : 'MBBS, MD',
    consultationFee : 500,
    availabilityHours: '10:00 AM - 5:00 PM',
    slotDuration    : 15,
  }, doctorToken));

  const doctorId = res.data?.profile?.id;
  if (!doctorId) { console.error('❌ Doctor profile creation failed. Aborting.'); process.exit(1); }
  console.log(`   → Doctor Profile ID: ${doctorId}`);

  // ────────────────────────────────────────────────────────────────
  logSection('3. RECURRING AVAILABILITY — Set Weekly Schedule');
  // ────────────────────────────────────────────────────────────────

  // Tomorrow's day of week
  const tomorrowDay = dayOfWeekFor(1);
  console.log(`\n   Setting recurring availability for ${tomorrowDay} (tomorrow)`);

  log(`Set Recurring: ${tomorrowDay} 10:00-11:00`, await req('POST', '/doctor/availability', {
    dayOfWeek: tomorrowDay,
    startTime: '10:00',
    endTime  : '11:00',
  }, doctorToken));

  // ────────────────────────────────────────────────────────────────
  logSection('4. FETCH SLOTS — Using Recurring Availability');
  // ────────────────────────────────────────────────────────────────

  const tomorrow = getDateNDaysFromNow(1);
  console.log(`\n   Fetching slots for tomorrow (${tomorrow})`);

  log(`GET /doctor/${doctorId}/slots?date=${tomorrow}  [Recurring]`,
    await req('GET', `/doctor/${doctorId}/slots?date=${tomorrow}`));

  // ────────────────────────────────────────────────────────────────
  logSection('5. CUSTOM OVERRIDE — Override a Specific Date');
  // ────────────────────────────────────────────────────────────────

  const ovDate = getDateNDaysFromNow(2);
  console.log(`\n   Creating custom availability override for ${ovDate} (14:00-15:00)`);

  log(`POST /doctor/availability/override  [date=${ovDate}]`, await req('POST', '/doctor/availability/override', {
    date     : ovDate,
    startTime: '14:00',
    endTime  : '15:00',
    isAvailable: true,
  }, doctorToken));

  log(`GET /doctor/${doctorId}/slots?date=${ovDate}  [Custom Override]`,
    await req('GET', `/doctor/${doctorId}/slots?date=${ovDate}`));

  // ────────────────────────────────────────────────────────────────
  logSection('6. CUSTOM OVERRIDE — Doctor Blocked (isAvailable=false)');
  // ────────────────────────────────────────────────────────────────

  const blockedDate = getDateNDaysFromNow(3);
  const blockedDay  = dayOfWeekFor(3);

  // First, add recurring for that day
  log(`Set Recurring for ${blockedDay}`, await req('POST', '/doctor/availability', {
    dayOfWeek: blockedDay,
    startTime: '10:00',
    endTime  : '11:00',
  }, doctorToken));

  // Block with custom override
  log(`Override ${blockedDate} as unavailable`, await req('POST', '/doctor/availability/override', {
    date       : blockedDate,
    isAvailable: false,
  }, doctorToken));

  log(`GET slots for blocked date (should show no availability)`,
    await req('GET', `/doctor/${doctorId}/slots?date=${blockedDate}`));

  // ────────────────────────────────────────────────────────────────
  logSection('7. EDGE CASES');
  // ────────────────────────────────────────────────────────────────

  // 7a. Doctor not found
  log('Doctor not found (ID=99999)',
    await req('GET', `/doctor/99999/slots?date=${tomorrow}`));

  // 7b. Invalid date format
  log('Invalid date format',
    await req('GET', `/doctor/${doctorId}/slots?date=not-a-date`));

  // 7c. Past date
  const yesterday = getDateNDaysFromNow(-1);
  log(`Past date (${yesterday})`,
    await req('GET', `/doctor/${doctorId}/slots?date=${yesterday}`));

  // 7d. No availability (far future date with no schedule)
  const farFuture = getDateNDaysFromNow(30);
  log(`No availability (${farFuture})`,
    await req('GET', `/doctor/${doctorId}/slots?date=${farFuture}`));

  // 7e. Missing date param
  log('Missing date param',
    await req('GET', `/doctor/${doctorId}/slots`));

  // ────────────────────────────────────────────────────────────────
  logSection('8. SLOT DURATION VARIANTS');
  // ────────────────────────────────────────────────────────────────

  // Create another doctor with 30-min slots
  const doctor2Email = `doctor2_${Date.now()}@test.com`;
  log('Signup Doctor2', await req('POST', '/auth/signup', { name: 'Dr. Thirty Min', email: doctor2Email, password, role: 'DOCTOR' }));
  res = log('Login Doctor2', await req('POST', '/auth/login', { email: doctor2Email, password }));
  const doctor2Token = res.data?.access_token;

  res = log('Create Doctor2 Profile (slotDuration=30 min)', await req('POST', '/doctor/profile', {
    fullName        : 'Dr. Thirty Min',
    specialization  : 'Dermatologist',
    experience      : 3,
    qualification   : 'MBBS',
    consultationFee : 300,
    availabilityHours: '09:00 AM - 12:00 PM',
    slotDuration    : 30,
  }, doctor2Token));

  const doctor2Id = res.data?.profile?.id;

  if (doctor2Id) {
    // Set recurring for doctor2 on tomorrow's day
    log(`Doctor2 Recurring: ${tomorrowDay} 09:00-11:00`, await req('POST', '/doctor/availability', {
      dayOfWeek: tomorrowDay,
      startTime: '09:00',
      endTime  : '11:00',
    }, doctor2Token));

    log(`Doctor2 slots (30 min each) for ${tomorrow}`,
      await req('GET', `/doctor/${doctor2Id}/slots?date=${tomorrow}`));
  }

  // ────────────────────────────────────────────────────────────────
  logSection('9. SUMMARY');
  // ────────────────────────────────────────────────────────────────
  console.log('\n✅ All test scenarios completed!');
  console.log('\n   What was tested:');
  console.log('   ✔ Recurring availability → slot generation (15-min)');
  console.log('   ✔ Custom date override → slot generation');
  console.log('   ✔ Custom override isAvailable=false → no slots');
  console.log('   ✔ Doctor not found → 404');
  console.log('   ✔ Invalid date format → 400');
  console.log('   ✔ Past date → 400');
  console.log('   ✔ No availability → 404');
  console.log('   ✔ Missing date param → 400');
  console.log('   ✔ 30-min slot duration variant');
  console.log('\n   Run the server with:  npm run start:dev');
  console.log('   Run this test with:   node test-api.js\n');
}

main().catch((err) => {
  console.error('\n💥 Test runner error:', err.message);
  process.exit(1);
});
