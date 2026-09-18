'use client'

import { useEffect, useMemo, useState } from 'react'
import CryptoJS from 'crypto-js'
import { supabase, type Ticket } from '@/lib/supabaseClient'

const CATEGORY_LABELS: Record<string, string> = {
  order: 'Đơn Hàng',
  decor: 'Decor',
  nitro: 'Nitro',
  boost: 'Boost',
  buy: 'Mua Hàng',
  support: 'Hỗ Trợ',
  warranty: 'Bảo Hành',
  extend: 'Gia Hạn',
}

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category.toLowerCase()] ?? category
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type UnlockState = 'locked' | 'loading' | 'unlocked'

export default function TranscriptVaultPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [unlockState, setUnlockState] = useState<UnlockState>('locked')
  const [keyInput, setKeyInput] = useState('')
  const [invalidKey, setInvalidKey] = useState(false)
  const [shake, setShake] = useState(false)
  const [decryptedHtml, setDecryptedHtml] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadTickets() {
      setLoadingTickets(true)
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isMounted) return
      if (error) {
        setLoadError(error.message)
      } else {
        setTickets(data ?? [])
      }
      setLoadingTickets(false)
    }

    loadTickets()
    return () => {
      isMounted = false
    }
  }, [])

  const categories = useMemo(() => {
    const unique = Array.from(new Set(tickets.map((t) => t.category)))
    return ['all', ...unique]
  }, [tickets])

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tickets.filter((t) => {
      const matchesCategory = activeFilter === 'all' || t.category === activeFilter
      const matchesQuery =
        !query ||
        t.ticket_name.toLowerCase().includes(query) ||
        t.user_name.toLowerCase().includes(query)
      return matchesCategory && matchesQuery
    })
  }, [tickets, search, activeFilter])

  function handleSelectTicket(ticket: Ticket) {
    setSelectedTicket(ticket)
    setUnlockState('locked')
    setKeyInput('')
    setInvalidKey(false)
    setDecryptedHtml(null)
  }

  function handleKeyChange(value: string) {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setKeyInput(cleaned)
    setInvalidKey(false)
  }

  async function handleUnlock() {
    if (!selectedTicket || keyInput.length !== 6 || unlockState === 'loading') return
    setUnlockState('loading')
    setInvalidKey(false)

    try {
      // Fetch qua API route nội bộ để tránh lỗi CORS khi gọi thẳng ra
      // trang tĩnh trên Vercel — xem app/api/vault-proxy/route.ts.
      const proxyUrl = `/api/vault-proxy?url=${encodeURIComponent(selectedTicket.transcript_url)}`
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error('Không tải được transcript')
      const rawHtml = await res.text()

      // Bóc payload {iv, ct} được nhúng trong thẻ <script id="vault-payload">
      // của trang HTML do encrypt_html_wrapper() (app.py) tạo ra.
      const match = rawHtml.match(
        /<script[^>]*id=["']vault-payload["'][^>]*>([\s\S]*?)<\/script>/
      )
      if (!match) throw new Error('Không tìm thấy dữ liệu mã hoá')

      const payload = JSON.parse(match[1]) as { iv: string; ct: string }

      // Giải mã bằng đúng logic phía server: key = SHA256(mã bảo mật),
      // AES-256-CBC với IV đi kèm.
      const key = CryptoJS.SHA256(keyInput)
      const iv = CryptoJS.enc.Hex.parse(payload.iv)
      const decrypted = CryptoJS.AES.decrypt(payload.ct, key, { iv })
      const html = decrypted.toString(CryptoJS.enc.Utf8)

      if (!html) throw new Error('Sai mã bảo mật')

      setDecryptedHtml(html)
      setUnlockState('unlocked')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 4000)
    } catch {
      setUnlockState('locked')
      setInvalidKey(true)
      setShake(true)
      setTimeout(() => setShake(false), 400)
    }
  }

  return (
    <div className="flex h-screen w-full bg-[#0E0D0C] text-[#EDE8E0] font-ui overflow-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        .font-maison {
          font-family: 'Fraunces', serif;
        }
        .font-ui {
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
        }
        @keyframes vaultShake {
          0%,
          100% {
            transform: translateX(0);
          }
          20%,
          60% {
            transform: translateX(-8px);
          }
          40%,
          80% {
            transform: translateX(8px);
          }
        }
        .vault-shake {
          animation: vaultShake 0.4s ease;
        }
        @keyframes vaultReveal {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .vault-reveal {
          animation: vaultReveal 0.5s ease;
        }
      `}</style>

      {/* ================= SIDEBAR ================= */}
      <aside className="w-[360px] shrink-0 border-r border-white/10 flex flex-col">
        <div className="px-6 pt-8 pb-6 border-b border-white/10">
          <h1 className="font-maison text-[26px] text-[#EDE8E0] tracking-wide">Aniko Sì To</h1>
          <p className="text-[13px] text-[#8C8378] mt-1.5">Transcript Vault</p>
          <p className="text-[11px] text-[#6B645A] mt-0.5">Hồ sơ giao dịch riêng tư</p>
        </div>

        <div className="px-5 py-4 space-y-3 border-b border-white/5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã ticket hoặc tên khách"
            className="w-full bg-[#1C1917] border border-white/10 rounded-sm px-3 py-2.5 text-sm text-[#EDE8E0] placeholder:text-[#6B645A] focus:outline-none focus:border-[#B08D57]/50 transition-colors"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                  activeFilter === cat
                    ? 'bg-[#B08D57]/15 border-[#B08D57]/60 text-[#D9C393]'
                    : 'border-white/10 text-[#8C8378] hover:border-white/20 hover:text-[#EDE8E0]'
                }`}
              >
                {cat === 'all' ? 'Tất cả' : categoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingTickets && (
            <p className="px-5 py-6 text-sm text-[#6B645A]">Đang tải danh sách...</p>
          )}

          {!loadingTickets && loadError && (
            <p className="px-5 py-6 text-sm text-red-400/80">Không tải được dữ liệu: {loadError}</p>
          )}

          {!loadingTickets && !loadError && filteredTickets.length === 0 && (
            <p className="px-5 py-6 text-sm text-[#6B645A]">Không tìm thấy hồ sơ phù hợp.</p>
          )}

          {filteredTickets.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTicket(t)}
              className={`w-full text-left px-5 py-3.5 border-b border-white/5 border-l-2 transition-colors ${
                selectedTicket?.id === t.id
                  ? 'bg-[#1C1917] border-l-[#B08D57]'
                  : 'border-l-transparent hover:bg-[#161412]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#EDE8E0] uppercase tracking-wide truncate">
                  {t.ticket_name}
                </span>
                <span className="text-[10px] text-[#6B645A] shrink-0">{formatDate(t.created_at)}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-[#8C8378] truncate">{t.user_name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-white/[0.03] border border-white/5 text-[#8C8378] shrink-0 ml-2">
                  {categoryLabel(t.category)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ================= WORKSPACE ================= */}
      <main className="flex-1 flex flex-col min-w-0">
        {!selectedTicket && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-xs">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5A5449"
                strokeWidth="1.2"
                className="mx-auto mb-5 opacity-70"
              >
                <rect x="3" y="7" width="18" height="13" rx="1.5" />
                <path d="M7 7V5a5 5 0 0 1 10 0v2" />
                <circle cx="12" cy="13" r="1.6" />
              </svg>
              <p className="text-sm text-[#8C8378]">
                Chọn một hồ sơ giao dịch từ danh sách bên trái để xem chi tiết.
              </p>
            </div>
          </div>
        )}

        {selectedTicket && (
          <>
            <div className="px-8 py-5 border-b border-white/10 flex items-start justify-between gap-6">
              <div className="min-w-0">
                <h2 className="font-maison text-xl text-[#EDE8E0] truncate">
                  {selectedTicket.ticket_name}
                </h2>
                <p className="text-xs text-[#8C8378] mt-1.5">
                  {selectedTicket.user_name} · nhân viên #{selectedTicket.staff_id}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block text-[10px] px-2.5 py-1 rounded-sm border border-[#B08D57]/30 text-[#D9C393]">
                  {categoryLabel(selectedTicket.category)}
                </span>
                <p className="text-[10px] text-[#6B645A] mt-2">{formatDate(selectedTicket.created_at)}</p>
              </div>
            </div>

            {unlockState !== 'unlocked' && (
              <div className="flex-1 flex items-center justify-center px-6">
                <div className="w-full max-w-sm text-center">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#B08D57"
                    strokeWidth="1.2"
                    className="mx-auto mb-6 opacity-80"
                  >
                    <rect x="5" y="11" width="14" height="9" rx="1.5" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  <p className="text-sm text-[#8C8378] mb-6">
                    Nhập mã bảo mật 6 ký tự để mở khoá bản ghi giao dịch này.
                  </p>
                  <input
                    value={keyInput}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                    maxLength={6}
                    disabled={unlockState === 'loading'}
                    placeholder="——————"
                    className={`w-full bg-[#1C1917] border rounded-sm px-4 py-4 text-center text-2xl tracking-[0.6em] uppercase text-[#EDE8E0] placeholder:text-[#3A362F] focus:outline-none transition-colors ${
                      invalidKey ? 'border-red-500/60' : 'border-white/10 focus:border-[#B08D57]/60'
                    } ${shake ? 'vault-shake' : ''}`}
                  />
                  {invalidKey && (
                    <p className="text-xs text-red-400/80 mt-3">
                      Invalid Key — mã bảo mật không đúng, vui lòng thử lại.
                    </p>
                  )}
                  <button
                    onClick={handleUnlock}
                    disabled={keyInput.length !== 6 || unlockState === 'loading'}
                    className="mt-5 w-full py-3 text-xs tracking-[0.1em] text-[#0E0D0C] bg-[#B08D57] rounded-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#C2A06A] transition-colors"
                  >
                    {unlockState === 'loading' ? 'Đang xác thực...' : 'Mở khoá'}
                  </button>
                </div>
              </div>
            )}

            {unlockState === 'unlocked' && decryptedHtml && (
              <div className="flex-1 relative vault-reveal min-h-0">
                {showToast && (
                  <div className="absolute top-4 right-4 z-10 bg-[#0E0D0C] border border-emerald-700/40 text-emerald-300 text-xs px-4 py-2.5 rounded-sm shadow-lg">
                    ✅ Authorization verified. Transcript unlocked.
                  </div>
                )}
                <iframe
                  srcDoc={decryptedHtml}
                  sandbox="allow-same-origin"
                  className="w-full h-full border-0 bg-white"
                  title={`transcript-${selectedTicket.ticket_name}`}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
