import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { getHtmlThemeClass, THEME_COOKIE } from '@/lib/theme'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata = {
  title: 'Paper-Flow ERP - Paper Bag Manufacturing',
  description: 'Enterprise Resource Planning and Manufacturing Execution System for Paper Bag Production',
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies()
  const theme = cookieStore.get(THEME_COOKIE)?.value ?? 'system'
  const themeClass = getHtmlThemeClass(theme)

  return (
    <html
      lang="en"
      className={[geist.variable, geistMono.variable, themeClass].filter(Boolean).join(' ')}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-background">
        <ThemeProvider
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
