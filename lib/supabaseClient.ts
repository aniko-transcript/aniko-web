import { createClient } from '@supabase/supabase-js'

// Dùng ANON KEY (public) ở đây — client này chạy trong trình duyệt.
// Bot Discord (Python) dùng SERVICE ROLE KEY riêng để ghi dữ liệu,
// còn trang dashboard này chỉ cần quyền SELECT qua policy RLS.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong biến môi trường.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Ticket {
  id: number
  ticket_name: string
  user_id: string
  user_name: string
  staff_id: string
  category: string
  transcript_url: string
  created_at: string
}
