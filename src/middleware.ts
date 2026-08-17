import { NextResponse, type NextRequest } from 'next/server';
import { CSRF_COOKIE, SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * Middleware d'administration (runtime Edge).
 *
 *  - dépose un jeton CSRF pour toutes les pages /admin ;
 *  - refuse l'accès aux pages protégées sans session valide ;
 *  - renvoie un administrateur déjà connecté vers son tableau de bord.
 *
 * Les autorisations fines (rôle, compte actif) sont revérifiées côté serveur
 * à chaque page et action : ce filtre n'est qu'une première barrière.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === '/admin/login';

  const secret = process.env.AUTH_SECRET ?? '';
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  const session = secret ? await verifySessionToken(token, secret) : null;

  // Le jeton CSRF est créé dès la première visite et injecté dans la requête
  // transmise au rendu : le formulaire de connexion dispose ainsi d'un jeton
  // valide dès son premier affichage.
  let issuedCsrf: string | null = null;
  if (!request.cookies.get(CSRF_COOKIE)?.value) {
    issuedCsrf = crypto.randomUUID().replace(/-/g, '');
    request.cookies.set(CSRF_COOKIE, issuedCsrf);
  }

  let response: NextResponse;

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
  matcher: ['/admin/:path*'],
};
