# Google Calendar connection

One-way sync sends saved Alex Rhythm schedules to a dedicated Google calendar. Apple Calendar can display this calendar by adding the same Google account; this is not a separate iCloud connection.

## Status

Code and migrations are ready. Google OAuth credentials are not configured in the Site yet. The connection button stays disabled until the four server settings below are present. Automated checks use a simulated Google API. A real OAuth round trip, real calendar updates and browser QA still require verification after setup.

## Google Cloud setup

1. Select or create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Calendar API**.
3. Set up the consent screen in Google Auth Platform. In Testing mode, add the intended Google account as a test user.
4. Create an OAuth client of type **Web application**.
5. Register this exact authorized redirect URI:

   ```text
   https://alex-rhythm.alexcaneat.chatgpt.site/api/calendar/callback
   ```

6. Configure these scopes:

   ```text
   openid
   email
   https://www.googleapis.com/auth/calendar.app.created
   ```

The calendar scope lets the application create secondary calendars and manage their events. Identity scopes display the account and keep reconnections to different Google accounts separate. The integration does not request access to the primary calendar, contacts or email contents.

Google may require domain verification or application verification. Resolve any Google rejection of the hosted domain or redirect URI before connecting; do not change the private planner's audience to work around it. With calendar scopes, refresh tokens for external apps in Testing mode can expire after seven days.

## Site environment

Set these values in the Site's production environment settings, then deploy the saved build with the new environment revision. Local `.env` files do not configure production.

| Key | Value | Secret |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Web client ID issued by Google | No |
| `GOOGLE_CLIENT_SECRET` | Matching client secret | Yes |
| `GOOGLE_REDIRECT_URI` | Exact URI above | No |
| `CALENDAR_TOKEN_KEY` | 32 cryptographically random bytes encoded as 64 hexadecimal characters | Yes |

Keep the encryption key stable across deployments. Replacing it requires reconnecting users because existing authorizations become unreadable. Never commit real environment values, client JSON, refresh tokens or encryption keys. `.env.example` contains empty placeholders only. Database migrations must be included in the deployment; the existing owner-private access policy remains unchanged.

## Connect and verify

1. In Alex Rhythm, open **Calendar connection** and choose **Connect Google account**.
2. Select the intended account and grant access on Google's page.
3. Verify that the connection shows that account and that **Alex Rhythm** appears in Google Calendar.
4. Save a test time block. Wait for **Up to date**, then check its title and time in Google Calendar.
5. Change the time: the same event should update. Cancel the block: only the corresponding event should disappear.
6. Add the same Google account to Calendar on iPhone or Mac and enable Alex Rhythm.

## Behavior and limits

- Only persisted `planner_days` records sync. Unsaved templates, planning drafts and backlog tasks do not. Fixed routines sync once saved in a day.
- The window covers yesterday through the next 60 days, no earlier than the initial connection date minus one day. Older events remain as history.
- The payload includes titles and planned times. Notes, next-step text, completion state and actual time logs stay in the planner. Titles are sent as saved and can themselves contain personal information.
- Times use `America/Toronto`, with midnight crossings and daylight-saving offsets. Nonexistent local times produce an error.
- Event reminders start disabled. Changing that block in the planner may reset an event reminder edited directly in Google.
- No attendees are added; requests use `sendUpdates=none` and send no invitations.
- Save/revision changes trigger sync while the page is visible. A 30-second visible-page check retries pending work. Larger batches continue in small steps. This version has no background worker or webhook: interrupted work resumes when the page is reopened.
- Stable identities preserve the same task's ordered segments through replanning. Adding/removing segments creates/deletes corresponding events.
- Persisted mappings recover from lost responses. Per-account database leases prevent simultaneous sync from multiple tabs.
- Rate limits wait five minutes; other temporary errors wait one minute. Invalid times, missing calendars and permission problems require attention.
- Changes in Google or Apple Calendar do not flow back to the planner. Remote edits are not continuously audited; a subsequent planner edit can overwrite them.
- Disconnect clears local authorization and attempts Google revocation, while retaining existing events. Access can also be revoked in Google account settings if Google was unreachable.
- Reconnecting the same account reuses its calendar and mappings. Switching accounts starts a separate calendar and preserves events in the previous account.
- Ambiguous calendar creation pauses automatically. Check Google Calendar before explicitly creating a replacement, avoiding repeated calendars.

## Security and validation

OAuth state is one-time and expires after ten minutes. It is bound to the authenticated planner user and a Secure, HttpOnly, SameSite=Lax browser cookie. PKCE protects the authorization-code exchange. Refresh tokens use AES-GCM encryption with the planner user as associated data; no tokens are returned to the browser. Changes require same-origin POST requests.

Automated tests cover missing configuration, authentication, origin checks, state replay and cross-account rejection, encryption isolation, Toronto DST, saved-only sync, event identity, update/delete, lost responses, batching, rate limits, disconnect and ambiguous creation. Existing planner checks continue to run.

## Official references

- [Google web-server OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Create events](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
- [Google calendars in Apple Calendar](https://support.google.com/calendar/answer/99358)
