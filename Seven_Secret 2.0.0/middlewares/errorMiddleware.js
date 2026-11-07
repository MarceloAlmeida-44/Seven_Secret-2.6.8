// Middleware de erros: deve ficar após todas as rotas.
module.exports = function errorMiddleware(err, req, res, next) {
  console.error('Erro no servidor:', err);
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  const mensagem = status === 500 ? 'Erro interno do servidor.' : (err.message || 'Erro na requisição.');
  if (req.path.startsWith('/api/')) return res.status(status).json({ erro: mensagem });
  res.status(status).send('Ocorreu um erro ao processar sua solicitação. <a href="/">Voltar para a loja</a>');
};
