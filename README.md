# DriveNow

## Google sign-in setup

Create a Google OAuth 2.0 Web client and add the frontend URL (for local development,
`http://localhost:3000`) as an authorized JavaScript origin. Set the same client ID in
`backend/.env` as `GOOGLE_CLIENT_ID` and `frontend/.env.local` as
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Copy the remaining frontend values from
`frontend/.env.example`; the backend values are listed in `backend/.env.example`.

Run the backend database migrations before starting the application so the Google ID
column and other current schema changes are present.