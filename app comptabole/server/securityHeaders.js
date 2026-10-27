/**
 * En-têtes de sécurité de toutes les réponses. La politique CSP est en mode « rapport seul » : elle n'empêche rien, elle fait apparaître
 * dans la console du navigateur ce qu'une politique stricte bloquerait, pour la durcir ensuite sans casser l'application.
 */
export const CSP_RAPPORT_SEUL = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy-Report-Only", CSP_RAPPORT_SEUL);
  // HTTPS seulement (derrière le proxy : req.secure vient de X-Forwarded-Proto) ; sans sous-domaines ni preload.
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000");
  next();
}
