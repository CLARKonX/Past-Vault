PASTVAULT — SUPABASE SETUP
=========================

FIRST-TIME SUPABASE SETUP
------------------------
1. In Supabase SQL Editor, run supabase-setup.sql once. This adds the
   profile email and upload MIME-type columns and creates student profiles
   automatically as Supabase Auth accounts are registered.
   For an existing project, also run question-pages-setup.sql once to enable
   multi-page image questions.
2. Open supabase-config.js and paste in your Supabase Project URL and
   publishable key. Never put a service_role or secret key in this file.
3. Confirm the private Storage bucket is named "question-files".
4. In Supabase Authentication settings, turn off Authentication → Providers
   → Email → Confirm email so students can register and log in without
   receiving confirmation messages. Email is still used as their login ID.
   Add the app's local and deployed URLs to the allowed site URLs.
5. The admin must have an Auth user and a matching row in public.profiles
   with role set to "admin". The SQL setup fills the profile email for
   existing Auth users.
6. Open the project through a local web server (for example, VS Code Live
   Server). Do not open the HTML files directly with file://.

RUNNING LOCALLY
---------------
Start VS Code Live Server from index.html. Students can upload one
PDF/document or multiple page images as one question. Admins can group image
pages into questions before publishing. Register students and sign in with
Supabase Auth. Admins sign in through admin-login.html using their Supabase
Auth email and password.

The site uses Supabase Auth, Postgres tables, and the private
"question-files" Storage bucket. Access depends on the Row Level Security
policies in the Supabase project. Do not disable RLS.

DATA
----
New accounts, profiles, departments, courses, uploads, and review decisions
are stored in Supabase. Existing data saved in a browser's localStorage is
not automatically imported. Use the Supabase dashboard to manage Auth
accounts; deleting a profile row alone does not delete its Auth account.

SECURITY
--------
The Project URL and publishable key are public client configuration values.
The service_role key and other secret keys must never be added to this
project or exposed in a browser.
