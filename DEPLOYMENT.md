# Deploy Kivo

## 1. Deploy the backend

### Render
1. Create a new Web Service from this repository.
2. Set the root directory to `backend`.
3. Set the build command to `npm install`.
4. Set the start command to `npm start`.
5. Add these environment variables:
   - `GEMINI_API_KEY`: your Gemini API key
   - `GEMINI_MODEL`: `gemini-3.8-flash`
   - `ALLOWED_ORIGINS`: your deployed frontend URL, for example `https://kivo-app.netlify.app`
6. Deploy and copy the backend URL, for example `https://kivo-api.onrender.com`.

## 2. Deploy the frontend

### Vercel
1. Import this repository and set the root directory to `frontend`.
2. Set the build command to `npm run build`.
3. Set the output directory to `dist`.
4. Add `VITE_API_URL=https://YOUR-BACKEND-URL`.
5. Deploy over HTTPS. Install it from the browser menu or the install button.

### Netlify
1. Create a new Netlify site from Git.
2. Set the base directory to `frontend`.
3. Set the build command to `npm run build`.
4. Set the publish directory to `frontend/dist`.
5. Add `VITE_API_URL=https://YOUR-BACKEND-URL`.

After the frontend deployment, add its exact HTTPS URL to the backend `ALLOWED_ORIGINS` value. Redeploy or restart the backend if needed.

## Local development

```powershell
npm run dev
```

The frontend proxy uses the local backend at `http://localhost:4000`.
