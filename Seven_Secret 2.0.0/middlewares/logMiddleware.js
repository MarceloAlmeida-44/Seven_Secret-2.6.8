// Log simples: não registra senha, corpo da requisição nem cookies.
module.exports = function logMiddleware(req, res, next) {
  const inicio = Date.now();
  res.on('finish', () => {
    const caminho = req.originalUrl.split('?')[0];
    console.log(`[${new Date().toLocaleString('pt-BR')}] ${req.method} ${caminho} -> ${res.statusCode} (${Date.now() - inicio}ms)`);
  });
  next();
};
