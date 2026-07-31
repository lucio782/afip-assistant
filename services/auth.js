const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'afip_assistant_dev_secret';
if (!process.env.JWT_SECRET) console.warn('ADVERTENCIA: JWT_SECRET no configurado. Usando secreto de desarrollo (inseguro).');

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, tier: user.tier }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Se requiere autenticación', code: 'AUTH_REQUIRED' });
  }
  const decoded = verifyToken(header.slice(7));
  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' });
  }
  req.userId = decoded.id;
  req.userEmail = decoded.email;
  req.userTier = decoded.tier || 'free';
  next();
}

module.exports = { generateToken, verifyToken, requireAuth };