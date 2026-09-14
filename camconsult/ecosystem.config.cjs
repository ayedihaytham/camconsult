// PM2 — démarre le site vitrine Next.js (process séparé de l'app comptable,
// voir app comptabole/deploy/ecosystem.config.cjs).
// Usage depuis la racine de ce dossier :
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup   (pour redémarrer au boot du serveur)

module.exports = {
  apps: [
    {
      name: "camconsult-site",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      // cwd est le dossier d'où on lance pm2 ; sinon fixez-le en absolu :
      // cwd: "/var/www/camconsult-site",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      // NEXT_PUBLIC_CLIENT_PORTAL_URL est lue depuis le fichier .env à la
      // racine de ce projet (voir .env.example).
    },
  ],
};
