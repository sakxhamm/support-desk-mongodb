import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireRole } from '../middleware/auth.js';

export function createParkingRouter({ store, authenticate }) {
  const router = Router();

  // GET /api/v1/slots?startTime=...&endTime=...
  router.get('/slots', authenticate, (req, res) => {
    const { startTime, endTime } = req.query;
    const hasWindow = Boolean(startTime && endTime);
    let startMs = null;
    let endMs = null;

    if (hasWindow) {
      startMs = Date.parse(String(startTime));
      endMs = Date.parse(String(endTime));
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TIME_WINDOW',
            message: 'startTime and endTime must be valid ISO timestamps with endTime > startTime',
          },
        });
      }
    }

    const slots = Array.from(store.slots.values()).map((slot) => {
      if (!hasWindow) return { ...slot };
      const conflict = store.findSlotConflict(slot.id, startMs, endMs);
      return {
        ...slot,
        availableForWindow: !slot.inMaintenance && !conflict,
      };
    });

    return res.status(200).json({ data: slots });
  });

  // POST /api/v1/reservations (Protected: any authenticated driver/operator)
  router.post('/reservations', authenticate, (req, res) => {
    const { slotId, startTime, endTime, vehiclePlate } = req.body ?? {};
    if (!slotId || !startTime || !endTime || !vehiclePlate) {
      return res.status(400).json({
        error: {
          code: 'INVALID_RESERVATION',
          message: 'slotId, startTime, endTime, and vehiclePlate are required',
        },
      });
    }

    const slot = store.slots.get(slotId);
    if (!slot) {
      return res.status(404).json({
        error: { code: 'SLOT_NOT_FOUND', message: `Parking slot ${slotId} not found` },
      });
    }

    if (slot.inMaintenance) {
      return res.status(409).json({
        error: {
          code: 'SLOT_IN_MAINTENANCE',
          message: `Parking slot ${slotId} is temporarily closed for maintenance`,
        },
      });
    }

    const startMs = Date.parse(String(startTime));
    const endMs = Date.parse(String(endTime));
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TIME_WINDOW',
          message: 'endTime must be a valid ISO timestamp strictly after startTime',
        },
      });
    }

    // Edge case: reject overlapping reservation windows for the same slot
    const conflict = store.findSlotConflict(slotId, startMs, endMs);
    if (conflict) {
      return res.status(409).json({
        error: {
          code: 'SLOT_RESERVATION_CONFLICT',
          message: `Slot ${slotId} is already reserved during ${conflict.startTime} - ${conflict.endTime}`,
          details: {
            slotId,
            conflictingWindow: {
              startTime: conflict.startTime,
              endTime: conflict.endTime,
            },
          },
        },
      });
    }

    const reservation = {
      id: `RES-${randomUUID().slice(0, 8)}`,
      slotId,
      userId: req.user.sub,
      vehiclePlate: String(vehiclePlate).trim().toUpperCase(),
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      startMs,
      endMs,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    store.reservations.set(reservation.id, reservation);

    return res.status(201).json({
      data: {
        id: reservation.id,
        slotId: reservation.slotId,
        userId: reservation.userId,
        vehiclePlate: reservation.vehiclePlate,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        status: reservation.status,
      },
    });
  });

  // GET /api/v1/reservations (Driver sees own; Operator sees all)
  router.get('/reservations', authenticate, (req, res) => {
    const all = Array.from(store.reservations.values());
    const visible =
      req.user.role === 'operator'
        ? all
        : all.filter((resv) => resv.userId === req.user.sub);

    return res.status(200).json({
      data: visible.map(({ startMs: _s, endMs: _e, ...rest }) => rest),
    });
  });

  // DELETE /api/v1/reservations/:id (Ownership OR operator role check)
  router.delete('/reservations/:id', authenticate, (req, res) => {
    const reservation = store.reservations.get(req.params.id);
    if (!reservation) {
      return res.status(404).json({
        error: { code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found' },
      });
    }

    const isOwner = reservation.userId === req.user.sub;
    const isOperator = req.user.role === 'operator';
    if (!isOwner && !isOperator) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only cancel your own parking reservations',
        },
      });
    }

    reservation.status = 'cancelled';
    return res.status(200).json({
      data: {
        id: reservation.id,
        slotId: reservation.slotId,
        status: reservation.status,
      },
    });
  });

  // PATCH /api/v1/slots/:id/maintenance (Operator-only role check)
  router.patch(
    '/slots/:id/maintenance',
    authenticate,
    requireRole('operator'),
    (req, res) => {
      const slot = store.slots.get(req.params.id);
      if (!slot) {
        return res.status(404).json({
          error: { code: 'SLOT_NOT_FOUND', message: `Parking slot ${req.params.id} not found` },
        });
      }

      if (typeof req.body?.inMaintenance !== 'boolean') {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'inMaintenance boolean is required',
          },
        });
      }

      slot.inMaintenance = req.body.inMaintenance;
      return res.status(200).json({ data: { ...slot } });
    }
  );

  return router;
}
