// Publicación con icono y manifest. El dominio sale de la variable APP_DOT (ver README.md).
export default {
  domain: process.env.APP_DOT,
  displayName: 'CampusChain',
  description: 'Marketplace universitario con historial de pedidos verificable en Polkadot.',
  icon: { path: './assets/icono.png', format: 'png' },
  executables: [{ kind: 'app', path: './dist', appVersion: [1, 0, 0] }],
};
