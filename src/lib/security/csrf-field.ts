/**
 * Nom du champ de formulaire portant le jeton CSRF.
 * Isolé dans un module neutre afin de rester importable par les composants
 * client, contrairement à `csrf.ts` qui accède aux cookies côté serveur.
 */
export const CSRF_FIELD = 'csrfToken';
