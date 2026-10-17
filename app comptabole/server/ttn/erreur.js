/**
 * Erreur de la chaîne de dépôt TTN, destinée à l'utilisateur : `message` est en français et ne contient jamais d'identifiant ni de
 * mot de passe. `code` permet aux routes et à l'écran de réagir ; `statut` est le code HTTP à renvoyer.
 */
export class ErreurTtn extends Error {
  constructor(code, message, statut = 502) {
    super(message);
    this.name = "ErreurTtn";
    this.code = code;
    this.statut = statut;
  }
}
