// Aplica el tema guardado antes del primer pintado (evita parpadeo)
try {
  const t = localStorage.getItem('ew:theme');
  if (t === 'nan' || t === 'helmcode') document.documentElement.dataset.theme = t;
} catch (_) {}
