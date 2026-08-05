# Vercel, Supabase, and Stripe setup

The application code is ready for Vercel. Complete these account-side steps once.

## 1. Create the Supabase database

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
3. In **Authentication > URL Configuration**, set the site URL to `https://old-school-apps.com`.
4. Add `https://old-school-apps.com/**` to **Redirect URLs**.
5. Copy the project URL, anon key, and service-role key from **Project Settings > API**.

### Social sign-in

Both providers use this Supabase callback URL:

`https://qjjwpqwqtsqxkxmwpabf.supabase.co/auth/v1/callback`

For Google:

1. Create an OAuth web application in Google Cloud Console.
2. Add the callback URL above as an authorized redirect URI.
3. In **Supabase > Authentication > Sign In / Providers > Google**, enter the
   client ID and client secret, then enable the provider.
4. Set `GOOGLE_OAUTH_ENABLED=true` in Vercel.

For Facebook:

1. Create a Facebook app and add the Facebook Login product.
2. Add the callback URL above as a valid OAuth redirect URI.
3. In **Supabase > Authentication > Sign In / Providers > Facebook**, enter
   the app ID and app secret, then enable the provider.
4. Set `FACEBOOK_OAUTH_ENABLED=true` in Vercel.

Enter provider secrets directly in Supabase. Do not put them in this repository.

## 2. Create the Stripe subscription

1. Create a Stripe product named `Old School Apps Pass`.
2. Add a recurring monthly price of `$10 USD` and copy its `price_...` ID.
3. After the first Vercel deployment, create a webhook endpoint:
   `https://old-school-apps.com/api/stripe-webhook`
4. Subscribe the webhook to:
   `checkout.session.completed`, `customer.subscription.updated`,
   and `customer.subscription.deleted`.
5. Copy the webhook signing secret.

## 3. Configure Vercel

Use separate Stripe credentials by Vercel environment. Keep Production on live
Stripe and configure Preview/Development with Stripe test credentials. Vercel
selects the correct values automatically; no code change or mode switch is
needed when testing a Preview deployment.

### Production variables

Add these variables to the **Production** environment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `GA4_MEASUREMENT_ID` (optional; defaults to `G-Y9KJ0W90MZ`)
- `GA4_API_SECRET` (required for server-side payment events)
- `SITE_URL=https://old-school-apps.com`
- `GOOGLE_OAUTH_ENABLED=false` until Google is configured in Supabase
- `FACEBOOK_OAUTH_ENABLED=false` until Facebook is configured in Supabase

For Production, use `sk_live_...`, the live `$10/month` price ID, and the live
webhook signing secret.

### Preview and Development variables

Add the same application variables to **Preview** and **Development**, but use
Stripe's test-mode values for these three entries:

- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...` from a test-mode webhook endpoint
- `STRIPE_PRICE_ID=price_...` for a test-mode recurring `$10/month` price

Keep `GA4_API_SECRET` in Preview if you want test payments reported to the
same GA4 property. Do not commit any secret values to this repository.

### Creating a safe Preview checkout

1. In Stripe, enable **Test mode** and create a recurring `$10/month` test
   price.
2. Create a test-mode webhook endpoint for the Preview URL:
   `https://<your-preview-domain>/api/stripe-webhook`.
3. Subscribe it to `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`, and `charge.refunded`.
4. Copy the test webhook signing secret into Vercel's Preview
   `STRIPE_WEBHOOK_SECRET` variable.
5. Redeploy the Preview deployment after saving environment variables.
6. Use card `4242 4242 4242 4242` with any future expiry, any CVC, and any ZIP.

The public Production deployment remains connected to live Stripe throughout
this process.

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
