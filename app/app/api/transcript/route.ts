import { NextRequest, NextResponse } from 'next/server'

// Chặn route này trở thành "open proxy": chỉ cho phép fetch các transcript
// được host trên tên miền Vercel mà bot Discord dùng để upload (xem
// upload_to_github_secret() trong app.py — link luôn dạng *.vercel.app).
// Nếu bạn đổi sang domain khác, cập nhật lại giá trị này.
const ALLOWED_HOST_SUFFIX = '.vercel.app'

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.json({ error: 'Thiếu tham số url' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }

  if (!parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return NextResponse.json({ error: 'Tên miền không được phép' }, { status: 403 })
  }

  try {
    // Fetch phía server để tránh CORS — trang transcript tĩnh trên Vercel
    // không (và không cần) khai báo Access-Control-Allow-Origin.
    const upstream = await fetch(parsed.toString(), { cache: 'no-store' })
    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream trả về ${upstream.status}` }, { status: 502 })
    }
    const html = await upstream.text()
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch {
    return NextResponse.json({ error: 'Không thể tải transcript' }, { status: 502 })
  }
}
