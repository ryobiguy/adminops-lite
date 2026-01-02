import jwt from 'jsonwebtoken';

export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');

  return jwt.sign(
    { userId: user.id, email: user.email },
    secret,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: { message: 'Access token required' } });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(403).json({ error: { message: 'Invalid token' } });
  }
}
