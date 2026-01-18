import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes allowed in waitlist mode (landing page + waitlist APIs only)
const WAITLIST_ALLOWED_ROUTES = [
  '/',
  '/api/subscribe',
  '/api/waitlist-count',
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // WAITLIST MODE: Block all routes except landing page and subscribe APIs
  // This is checked server-side only - the env var is NOT exposed to clients
  if (process.env.WAITLIST_MODE === 'true') {
    const isAllowed = WAITLIST_ALLOWED_ROUTES.some(route =>
      route === pathname ||
      (route.endsWith('/') && pathname.startsWith(route))
    )

    if (!isAllowed) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // In waitlist mode, just serve the allowed routes without auth checks
    return NextResponse.next()
  }

  // Normal mode below (when WAITLIST_MODE is not 'true')
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  if (
    !user &&
    (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/research'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from login page
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
