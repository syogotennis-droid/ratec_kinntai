'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyPassword, createToken, authMiddleware } = require('../auth');

// POST /api/auth/login
// Supports both OAuth2 form (username + password) and JSON (employee_id + password)
router.post('/login', (req, res) => {
  const body = req.body || {};

  // Support both form (username) and JSON (employee_id)
  const employeeId = body.username || body.employee_id;
  const password = body.password;

  if (!employeeId || !password) {
    return res.status(400).json({ error: '社員番号とパスワードを入力してください' });
  }

  const user = db.prepare('SELECT * FROM users WHERE employee_id = ? AND is_active = 1').get(employeeId);
  if (!user) {
    return res.status(401).json({ error: '社員番号またはパスワードが正しくありません' });
  }

  if (!verifyPassword(password, user.hashed_password)) {
    return res.status(401).json({ error: '社員番号またはパスワードが正しくありません' });
  }

  const payload = {
    id: user.id,
    employee_id: user.employee_id,
    name: user.name,
    is_admin: user.is_admin === 1,
  };

  const token = createToken(payload);

  const { hashed_password, ...userWithoutPassword } = user;
  userWithoutPassword.is_admin = user.is_admin === 1;

  return res.json({
    access_token: token,
    token_type: 'bearer',
    user: userWithoutPassword,
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare(
    'SELECT id, employee_id, name, name_kana, email, department, employment_type, hourly_wage, daily_wage, transportation, fixed_allowance, overtime_rate, late_night_rate, holiday_rate, is_admin, is_active, created_at, updated_at FROM users WHERE id = ? AND is_active = 1'
  ).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'ユーザーが見つかりません' });
  }

  user.is_admin = user.is_admin === 1;
  return res.json(user);
});

module.exports = router;
