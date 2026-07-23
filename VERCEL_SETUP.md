# Vercel, Supabase, and Stripe setup

The application code is ready for Vercel. Complete these account-side steps once.

## 1. Create the Supabase database

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
3. In **Authentication > URL Configuration**, set the site URL to `https://old-school-apps.com`.
4. Copy the project URL, anon key, and service-role key from **Project Settings > API**.

## 2. Create the Stripe subscription

1. Create a Stripe product named `Typewriter Notes Pro`.
2. Add a recurring monthly price and copy its `price_...` ID.
3. After the first Vercel deployment, create a webhook endpoint:
   `https://old-school-apps.com/api/stripe-webhook`
4. Subscribe the webhook to:
   `checkout.session.completed`, `customer.subscription.updated`,
   and `customer.subscription.deleted`.
5. Copy the webhook signing secret.

## 3. Configure Vercel

Add these environment variables to Production, Preview, and Development:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `SITE_URL=https://old-school-apps.com`

Never expose the Supabase service-role key or Stripe secret key in browser code.

## 4. Move the custom domain

1. Add `old-school-apps.com` and `www.old-school-apps.com` to the Vercel project.
2. Replace the old GitHub Pages DNS records with the exact records Vercel displays.
3. Make `old-school-apps.com` the primary domain and redirect `www` to it.
4. Remove the GitHub Pages custom domain only after Vercel reports both domains valid.

## 5. Verify

1. Create an account and confirm the email.
2. Write a note, sign out, sign back in, and confirm it restores.
3. Complete a Stripe test checkout using card `4242 4242 4242 4242`.
4. Confirm the account shows Pro, PDF export works, and Billing opens Stripe Portal.
5. Cancel in Stripe Portal and confirm the account returns to Free after the webhook.
