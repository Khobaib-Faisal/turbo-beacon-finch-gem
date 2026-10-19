# PYQ image storage setup

The importer stores question text and answers in Postgres, and stores the larger
original PDF captures in a Neon Object Storage bucket. The bucket must be named
`pyq-question-images` and have **Public read** access because question images
are shown in the public question bank.

## One-time setup

1. In Neon, open the app's production `main` branch and open **Object storage**.
2. Create the `pyq-question-images` bucket with **Public read** access.
3. In the same branch, open **Credentials** and create a credential with
   `storage:read` and `storage:write` scopes. Save the secret when Neon shows it;
   Neon only displays it once.
4. In Vercel, open the `jee-dashboard` project → **Settings** → **Environment
   Variables**. Add these variables to **Production** (and Preview if needed):
   `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`.
   Use the endpoint and region shown by Neon for the production `main` branch;
   use the credential's `token_id` as `AWS_ACCESS_KEY_ID` and
   `s3_secret_access_key` as `AWS_SECRET_ACCESS_KEY`. Never paste the secret in
   GitHub or chat.
5. Redeploy from Vercel so the new environment variables are active.

Object Storage availability and included capacity depend on the Neon plan and
the Vercel-managed integration. Check the Neon/Vercel usage page before moving
the full image collection; no plan upgrade is required by this code.

## Move existing images

After the deployment is ready, open `/admin/pyq-import` and use **Move existing
images to Neon Storage**. Keep the page open until it reports zero remaining.
This migrates only image bytes; question rows, answers, years, and chapters stay
in Postgres. The importer will write future images to the bucket automatically.
Then run `VACUUM (ANALYZE) pyq_questions;` once in Neon SQL Editor so Postgres
can reclaim space from the old inline image values.

If migration reports a storage/configuration error, stop there and check the
branch, bucket access, and Vercel variables. Do not delete question rows.
