// PM2 — démarre l'API + le front buildé de l'app comptable (un seul
// process). Le site vitrine (camconsult/) est un projet séparé, avec son
// propre ecosystem.config.cjs — voir camconsult/ecosystem.config.cjs.
// Usage depuis la racine du projet :
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save && pm2 startup   (pour redémarrer au boot du serveur)

module.exports = {
  apps: [
    {
      name: "app-comptable",
      script: "server/index.js",
      // cwd est le dossier d'où on lance pm2 ; sinon fixez-le en absolu :
      // cwd: "/var/www/camconsult",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      // Les autres variables (DATABASE_URL, JWT_SECRET, CORS_ORIGIN, ADMIN_*,
      // API_PORT) sont lues depuis le fichier .env à la racine du projet.
    },
  ],
};
