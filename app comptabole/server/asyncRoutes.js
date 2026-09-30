// Express 4 ne transmet pas les rejets des handlers async : une erreur SQL
// laisse la requête pendre indéfiniment (l'interface n'affiche alors rien).
// `safeRouter` enveloppe les handlers d'un routeur pour renvoyer l'erreur au
// middleware d'erreurs global (réponse 500 JSON + journal serveur).
const METHODS = ["get", "post", "put", "patch", "delete"];

export function safeRouter(router) {
  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) =>
      original(
        path,
        ...handlers.map((h) =>
          typeof h === "function" && h.length < 4
            ? (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
            : h,
        ),
      );
  }
  return router;
}
