'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = 'attendance-system-secret-key-2024-min32chars';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function createToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'トークンが無効または期限切れです' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  next();
}

module.exports = { hashPassword, verifyPassword, createToken, authMiddleware, adminMiddleware };
