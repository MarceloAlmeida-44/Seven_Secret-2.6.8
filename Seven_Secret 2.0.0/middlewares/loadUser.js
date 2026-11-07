// Recupera o usuário da sessão no MySQL para as próximas rotas.
module.exports = function loadUser(pool) {
  return async function (req, res, next) {
    try {
      req.currentUser = null;
      if (req.session && req.session.userId) {
        const [rows] = await pool.execute(
          'SELECT id,nome,cpf,nascimento,email,password_hash AS passwordHash FROM usuarios WHERE id=?',
          [req.session.userId]
        );
        req.currentUser = rows[0] || null;
      }
      next();
    } catch (err) { next(err); }
  };
};
