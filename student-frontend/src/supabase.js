import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gpomrugfulrrfbbjptaa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwb21ydWdmdWxycmZiYmpwdGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDA5MDYsImV4cCI6MjA4MTE3NjkwNn0.009DuvnsepbRuQ7zj6LNr9uX8XbMyhHzlA3CZTnVaMk'

export const supabase = createClient(supabaseUrl, supabaseKey)