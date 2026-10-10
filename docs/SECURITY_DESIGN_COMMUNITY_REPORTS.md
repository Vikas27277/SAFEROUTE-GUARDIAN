# Security Design: Guardian Reports MVP

## 1. Privacy and Anonymity
- **Pseudonymity**: Reporter identity must not be publicly exposed. The `createdBy` field should be treated as a pseudonymous identifier used only internally for vote tracking and rate limiting, never displayed on public map popups or endpoints.
- **Data Minimization**: Do not store sensitive personal information (PII) in public report fields (title, description, image).
- **Scope Restriction**: Suspicious-person reporting is intentionally NOT included in this MVP. The scope is strictly limited to road and environmental conditions.

## 2. Integrity and Manipulation Prevention
- **Vote Limiting**: One user can have only one active vote per report (either confirm or inaccurate). Users must not eventually be able to manipulate reports through unlimited votes.
- **Rate Limiting**: Users are strictly limited by `maxReportsPerHourPerUser` and `maxVotesPerHourPerUser` configuration values to prevent spam and bot manipulation.
- **Moderator Override**: Moderator decisions take precedence over community voting. A moderator's verification or rejection is absolute and overrides the `communityVerificationThreshold`.

## 3. Data Lifecycle
- **Freshness and Expiry**: Reports must have freshness/expiry constraints (`expiresAt`, `reportFreshnessHours`). Road hazards are transient; a report without recent confirmation must expire naturally and be removed from the active safety pipeline.

## 4. Fundamental Safety Rule
- **UNVERIFIED COMMUNITY REPORTS MUST NOT AFFECT THE SAFETY SCORE.**
- Community reports are safety signals, not guarantees. 
- Only reports that have reached the `COMMUNITY_VERIFIED` or `MODERATOR_VERIFIED` status are trusted safety signals.
- Future Flow: Report → Verification → Trusted safety signal → Safety analysis → Route scoring.

## 5. Authentication and Identity
- **Source of Truth**: Authentication identity strictly comes from Firebase Auth. Client state is NOT the authority for permissions.
- **Role Assignment**: A user cannot promote themselves to moderator/admin.
- **Server-Side Enforcement**: Moderator/admin actions must eventually be verified server-side (via custom claims or server validation).
- **Firebase Security Rules**: Firebase Security Rules will be required before production deployment.
- **Secret Protection**: Authentication credentials/secrets must never be committed.
