import { Router } from 'express';
import { pool } from '../db.js';
import { requireMenu } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { buildCommand, normalizeTargets, PLAYER_COMMANDS } from '../utils/commands.js';
import { enqueueCommand, recentCommands, recordDone } from '../services/commands.js';
import { listPendingPairings } from '../services/pairing.js';
import { logActivity } from '../services/audit.js';
import { getOsConfig, saveOsConfig } from '../services/osConfig.js';

const router = Router();
const canControl = requireMenu('control');

/** Command history (newest first). */
router.get(
  '/commands',
  canControl,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await recentCommands(60) });
  })
);

/** TVs on the network that are showing a pairing code, waiting to be adopted. */
router.get(
  '/pending-pairings',
  canControl,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listPendingPairings() });
  })
);

/**
 * Send one command to many screens.
 * Body: { screenIds: string[], command, text?, durationSec?, style? }
 * Player commands are queued and delivered through each screen's next heartbeat (≤ 10 s).
 * `standby` / `resume` are applied immediately by the server.
 */
router.post(
  '/commands',
  canControl,
  asyncHandler(async (req, res) => {
    const screenIds = normalizeTargets(req.body?.screenIds);
    const { command, payload, ttlSec } = buildCommand(req.body);
    const actor = req.user?.name || 'admin';
    let queued = 0;
    let unknown = [];

    if (PLAYER_COMMANDS.includes(command)) {
      ({ queued, unknown } = await enqueueCommand({ screenIds, command, payload, ttlSec, actor }));
    } else {
      const [known] = await pool.query('SELECT id FROM screens WHERE id IN (?)', [screenIds]);
      const ids = known.map((r) => r.id);
      unknown = screenIds.filter((id) => !ids.includes(id));
      if (ids.length > 0) {
        if (command === 'standby') {
          await pool.query(
            "UPDATE screens SET is_active=0, connection_status='Offline', last_seen='Turned Off (Standby)' WHERE id IN (?)",
            [ids]
          );
        } else {
          await pool.query('UPDATE screens SET is_active=1, wake_requested=1, playback_error=NULL WHERE id IN (?)', [ids]);
        }
        await recordDone({ screenIds: ids, command, actor });
      }
      queued = ids.length;
    }

    await logActivity('control', `Remote command: ${command}`, `${queued} screen(s)${payload?.text ? ` – "${payload.text}"` : ''}`, actor);
    res.json({
      success: true,
      queued,
      unknown,
      message: queued === 0 ? 'No matching screens.' : `${command.replace('_', ' ')} sent to ${queued} screen${queued === 1 ? '' : 's'}.`,
    });
  })
);

/** DYPIU OS settings (apps on the TV home screen, idle timings, staff PIN). */
router.get(
  '/os-config',
  canControl,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getOsConfig() });
  })
);

router.put(
  '/os-config',
  canControl,
  asyncHandler(async (req, res) => {
    const data = await saveOsConfig(req.body || {});
    await logActivity('control', 'DYPIU OS settings updated', '', req.user?.name || 'admin');
    res.json({ success: true, data });
  })
);

export default router;
