let contexte: AudioContext | null = null;

/** Petit « ding » doux à deux notes, comme celui d'une messagerie, joué à l'arrivée d'une notification.
 * Silencieux (sans erreur) si le navigateur n'a pas d'audio ou bloque le son avant toute interaction. */
export function jouerSonNotification() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    contexte ??= new AudioCtx();
    const ctx = contexte;
    if (ctx.state === "suspended") void ctx.resume();
    const debut = ctx.currentTime;
    [
      { frequence: 880, decalage: 0 },
      { frequence: 1319, decalage: 0.13 },
    ].forEach(({ frequence, decalage }) => {
      const oscillateur = ctx.createOscillator();
      const volume = ctx.createGain();
      oscillateur.type = "sine";
      oscillateur.frequency.value = frequence;
      volume.gain.setValueAtTime(0.0001, debut + decalage);
      volume.gain.exponentialRampToValueAtTime(0.18, debut + decalage + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, debut + decalage + 0.35);
      oscillateur.connect(volume).connect(ctx.destination);
      oscillateur.start(debut + decalage);
      oscillateur.stop(debut + decalage + 0.4);
    });
  } catch {
    /* le son est un confort : jamais d'erreur à l'écran */
  }
}
