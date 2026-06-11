export const ERROR_MESSAGES = {
  DOCTOR_PROFILE_NOT_FOUND: 'Doctor profile not found',
  TIME_RANGE_INVALID: 'Invalid time range: startTime must be before endTime',
  TIME_RANGE_REQUIRED: 'startTime and endTime are required when isAvailable is true',
  OVERLAP: 'Time slot overlaps with existing availability',
  DUPLICATE_SLOT: 'Exact same time slot already exists for this day',
  RECURRING_NOT_FOUND: 'Recurring availability not found',
  UNAUTHORIZED_UPDATE: 'You can only update your own availability',
  UNAUTHORIZED_DELETE: 'You can only delete your own availability',
  INVALID_DATE_FORMAT: 'Invalid date format',
  PATIENT_PROFILE_EXISTS: 'Patient profile already exists for this user.',
  PATIENT_PROFILE_NOT_FOUND: 'Patient profile not found.',
  DOCTOR_PROFILE_EXISTS: 'Doctor profile already exists for this user.',
  UPLOAD_FAILED: 'Failed to upload profile picture',
  DELETE_PIC_FAILED: 'Failed to delete existing profile picture',
  SEARCH_TOO_SHORT: 'Search requires a text query of at least 3 characters.',
  EMAIL_EXISTS: 'Email already exists',
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_TOKEN: 'Invalid token',
};

export const getDoctorNotFoundMessage = (id: number) => `Doctor with ID ${id} not found.`;

export const RESPONSE_MESSAGES = {
  DELETE_SUCCESS: 'Availability deleted successfully',
};
