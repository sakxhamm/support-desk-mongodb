import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

/**
 * Checks whether two [start, end) ISO time windows overlap.
 * Adjacent windows (e.g. 10:00-11:00 and 11:00-12:00) do NOT conflict.
 */
export function hasTimeOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

export function createParkingStore() {
  const users = new Map();
  const slots = new Map();
  const reservations = new Map();

  // Seed sample accounts with bcrypt-hashed passwords (no plaintext stored)
  const seedUsers = [
    {
      id: 'usr-driver-1',
      email: 'driver1@campus.edu',
      name: 'Aarav Mehta',
      role: 'driver',
      passwordHash: bcrypt.hashSync('DriverPass#1', BCRYPT_ROUNDS),
    },
    {
      id: 'usr-driver-2',
      email: 'driver2@campus.edu',
      name: 'Neha Kapoor',
      role: 'driver',
      passwordHash: bcrypt.hashSync('DriverPass#2', BCRYPT_ROUNDS),
    },
    {
      id: 'usr-operator-1',
      email: 'operator@smartpark.io',
      name: 'Lot Operator',
      role: 'operator',
      passwordHash: bcrypt.hashSync('OperatorPass#1', BCRYPT_ROUNDS),
    },
  ];

  for (const user of seedUsers) {
    users.set(user.email, user);
  }

  const seedSlots = [
    { id: 'A-101', zone: 'North Gate', type: 'standard', inMaintenance: false },
    { id: 'A-102', zone: 'North Gate', type: 'standard', inMaintenance: false },
    { id: 'EV-201', zone: 'EV Charger Bay', type: 'ev', inMaintenance: false },
  ];

  for (const slot of seedSlots) {
    slots.set(slot.id, slot);
  }

  return {
    users,
    slots,
    reservations,
    findSlotConflict(slotId, startMs, endMs) {
      for (const resv of reservations.values()) {
        if (resv.slotId !== slotId || resv.status !== 'active') continue;
        if (hasTimeOverlap(resv.startMs, resv.endMs, startMs, endMs)) {
          return resv;
        }
      }
      return null;
    },
  };
}
