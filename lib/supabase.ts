import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://povtxolmajhxrnwqyjhd.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdnR4b2xtYWpoeHJud3F5amhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MjI1NjAsImV4cCI6MjExMDE5ODU2MH0.5QXML4dcsBCVYc5LVje44XyBGKHNUOhJgJa2hgv1iX4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
