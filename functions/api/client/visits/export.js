// GET /api/client/visits/export: every count kept for this project's site, as CSV (server/visits.js).
import { exportResponse } from '../../../../server/visits.js';

export const onRequestGet = ({ env, data }) => exportResponse(env, data.project);
