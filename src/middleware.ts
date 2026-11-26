import { NextResponse, type NextRequest } from 'next/server';
import { CSRF_COOKIE, SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { ACCOUNT_SESSION_COOKIE, verifyAccountToken } from '@/lib/auth/account-session';

/**
 * Middleware (runtime Edge).
 *
 *  - dépose un jeton CSRF pour les pages /admin, /compte et /ker-care ;
 *  - /admin : refuse l'accès aux pages protégées sans session administrateur
 *    et renvoie un administrateur déjà connecté vers son tableau de bord ;
 *  - /ker-care/mon-espace et /ker-care/prestataire : exige une session de
 *    compte Kër+ (client ou prestataire).
 *
 * Les autorisations fines (rôle, compte actif, appartenance des ressources)
 * sont revérifiées côté serveur à chaque page et action : ce filtre n'est
 * qu'une première barrière.
 */

const ACCOUNT_AREAS = ['/ker-care/mon-espace', '/ker-care/prestataire'];

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const secret = process.env.AUTH_SECRET ?? '';

  // Le jeton CSRF est créé dès la première visite et injecté dans la requête
  // transmise au rendu : les formulaires disposent ainsi d'un jeton valide dès
  // leur premier affichage.
  let issuedCsrf: string | null = null;
  if (!request.cookies.get(CSRF_COOKIE)?.value) {
    issuedCsrf = crypto.randomUUID().replace(/-/g, '');
    request.cookies.set(CSRF_COOKIE, issuedCsrf);
  }

  let response: NextResponse;

  if (isUnder(pathname, '/admin')) {
    const isLoginPage = pathname === '/admin/login';
    const token = request.cookies.get(SESSION_COOKIE)?.value ?? '';
    const session = secret ? await verifySessionToken(token, secret) : null;

    if (!session && !isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
      response = NextResponse.redirect(url);
    } else if (session && isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/dashboard';
      url.search = '';
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next({ request: { headers: request.headers } });
    }
  } else if (ACCOUNT_AREAS.some((area) => isUnder(pathname, area))) {
    const token = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value ?? '';
    const session = secret ? await verifyAccountToken(token, secret) : null;
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = '/compte/connexion';
      url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next({ request: { headers: request.headers } });
    }
  } else {
    response = NextResponse.next({ request: { headers: request.headers } });
  }

  if (issuedCsrf) {
    response.cookies.set(CSRF_COOKIE, issuedCsrf, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/compte/:path*', '/ker-care/:path*'],
};
