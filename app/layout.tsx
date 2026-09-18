export const metadata = {
  title: 'Aniko Transcript Vault',
  description: 'Hệ thống quản lý bản ghi Ticket Discord',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
