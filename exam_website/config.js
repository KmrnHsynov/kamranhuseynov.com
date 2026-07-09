// Shared Supabase client config for exam.html and admin.html.
// The anon key is safe to ship client-side by design — access control is
// enforced server-side via RLS/RPCs, not by keeping this key secret.
//
// Fill these in with YOUR new Supabase project's values
// (Dashboard → Project Settings → API), after running schema.sql there.
const SUPABASE_URL  = 'https://ecqjliebtsbrzqoersbc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcWpsaWVidHNicnpxb2Vyc2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzA1NjQsImV4cCI6MjA5OTEwNjU2NH0.Y4FrAL_2y8e5IpTbtqaZTDXeMKXKkG1b8w2zNTAqHFA';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
