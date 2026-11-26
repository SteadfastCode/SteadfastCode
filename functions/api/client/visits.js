// GET /api/client/visits?days=30: this project's visit counts (server/visits.js), while it has a
// care plan and for 90 days after one ends.
import { visitsResponse } from '../../../server/visits.js';

export const onRequestGet = ({ request, env, data }) => visitsResponse(env, data.project, new URL(request.url));
