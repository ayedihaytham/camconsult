/**
 * Erreur de la chaîne de signature, destinée à l'utilisateur : `message` est en français et ne contient jamais de secret
 * (ni mot de passe, ni clé, ni contenu du certificat). `code` permet à l'écran et aux routes de réagir.
 */
export class ErreurSignature extends Error {
  constructor(code, message, statut = 422) {
    super(message);
    this.name = "ErreurSignature";
    this.code = code;
    this.statut = statut;
  }
}
