function requireAdmin(req, res, next) {

    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            erro: 'Você precisa estar logado.'
        });
    }

    if (req.session.role !== 'admin') {
        return res.status(403).json({
            erro: 'Acesso permitido apenas para administradores.'
        });
    }

    next();
}

module.exports = requireAdmin;