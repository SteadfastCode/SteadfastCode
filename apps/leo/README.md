# SteadfastCode - LeoAI

## Project Setup (Windows)

### Client
1. Navigate to the client directory:
   ```
   cd client
   ```
2. Install dependencies:
   ```
   yarn install
   ```
3. Create a `.env` file in `/client` with:
   ```
   VITE_ONESIGNAL_APP_ID=your-onesignal-app-id
   VITE_STRIPE_KEY=pk_test_your_stripe_key
   ```
4. Run the development server:
   ```
   yarn serve
   ```
   - Access at `http://localhost:8080`.

### Server
1. Navigate to the server directory:
   ```
   cd server
   ```
2. Install dependencies:
   ```
   yarn install
   ```
3. Create a `.env` file in `/server` with:
   ```
   MONGODB_URI=your_mongodb_uri
   STRIPE_SECRET_KEY=sk_test_your_stripe_key
   ```
4. Start the server:
   ```
   yarn start
   ```
   - Check health at `http://localhost:3000/api/health`.

### OneSignal Setup (Post-MVP)
1. Add OneSignal App ID to `/client/.env`.
2. Place `OneSignalSDKWorker.js` in `/client/public`.
3. Test notifications at `http://localhost:8080`.

### Deployment
- Push to `main` for Vercel auto-deploy.
- Add env vars in Vercel Dashboard.
- Verify at `https://steadfastcode.vercel.app`.