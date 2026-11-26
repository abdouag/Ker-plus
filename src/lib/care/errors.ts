/** Erreur métier Kër Care : message destiné à l'utilisateur, code HTTP indicatif. */
export class CareError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'CareError';
  }
}
