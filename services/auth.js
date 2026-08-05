const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET no está configurado. Definilo en .env o en las variables de entorno del servidor.');
  throw new Error('JWT_SECRET es requerido');
}

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