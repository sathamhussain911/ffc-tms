import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't need authentication
const PUBLIC_ROUTES = ['/login', '/driver/login']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession()

  const path = request.nextUrl.pathname

  // Allow public routes through
  if (PUBLIC_ROUTES.some(r => path.startsWith(r))) {
    // If already logged in and visiting login, redirect to appropriate home
    if (session) {
      if (path.startsWith('/driver/login')) {
        return NextResponse.redirect(new URL('/driver', request.url))
      }
      if (path === '/login') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return response
  }

  // Allow static files and API routes
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.startsWith('/manifest') ||
    path.startsWith('/icon') ||
    path.startsWith('/sw.js') ||
    path.startsWith('/workbox')
  ) {
    return response
  }

  // Not authenticated — redirect to correct login
  if (!session) {
    if (path.startsWith('/driver')) {
      return NextResponse.redirect(new URL('/driver/login', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json|sw\\.js|workbox-.*\\.js).*)',
  ],
}
