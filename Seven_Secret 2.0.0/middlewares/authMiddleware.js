// Mantém a mesma regra de administrador que já existia no projeto.
const isAdmin = u => !!u && String(process.env.ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  .includes(String(u.email || '').toLowerCase());

function requireLogin(req, res, next) {
  if (!req.currentUser) return res.status(401).json({ erro: 'Entre na sua conta antes de finalizar a compra.' });
  next();
}

function requireAdmin(req, res, next) {
  const u = req.currentUser;
  if (!u) return res.status(401).json({ erro: 'Entre na sua conta para continuar.' });
  if (!isAdmin(u)) return res.status(403).json({ erro: 'Você não tem permissão para cadastrar produtos.' });
  next();
}
module.exports = { isAdmin, requireLogin, requireAdmin };
