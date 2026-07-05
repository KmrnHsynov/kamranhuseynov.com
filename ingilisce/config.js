// Shared Supabase client config for ingilisce.html and admin.html.
// The anon key is safe to ship client-side by design — access control is
// enforced server-side via RLS/RPCs, not by keeping this key secret.
const SUPABASE_URL  = 'https://krrzidmvtudulflxzrqj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtycnppZG12dHVkdWxmbHh6cnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NTQ1NzYsImV4cCI6MjA5ODAzMDU3Nn0.zj6zfL7WsCugBGi5rjLbBQ-wmt6Q4q-lNNxc72M8Vj4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
