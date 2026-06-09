'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware, adminMiddleware } = require('../auth');

// GET /export/:yearMonth - CSV出力（管理者のみ）※ /:yearMonth より前に定義
router.get('/export/:yearMonth', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { yearMonth } = req.params;

    const users = db
      .prepare('SELECT id, name, employee_id FROM users WHERE is_active = 1 AND is_admin = 0 ORDER BY employee_id')
      .all();

    const rows = users.map(u => {
      const salesRows = db
        .prepare("SELECT * FROM sales_records WHERE user_id = ? AND record_date LIKE ?")
        .all(u.id, `${yearMonth}-%`);
      const total_sales = salesRows.reduce((s, r) => s + (r.sales_amount || 0), 0);
      const total_material = salesRows.reduce((s, r) => s + (r.material_cost || 0), 0);
      const total_profit = total_sales - total_material;

      const bonus = db
        .prepare('SELECT * FROM bonuses WHERE user_id = ? AND year_month = ?')
        .get(u.id, yearMonth);

      return [
        u.employee_id,
        u.name,
        yearMonth,
        total_sales,
        total_material,
        total_profit,
        bonus?.bonus_amount || 0,
        bonus?.notes || '',
      ];
    });

    const headers = ['社員番号', '氏名', '年月', '売上合計', '材料費合計', '利益合計', 'ボーナス', 'メモ'];
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bonuses_${yearMonth}.csv"`);
    res.send('﻿' + csv);
  } catch (err) {
    console.error('ボーナスCSV出力エラー:', err);
    res.status(500).json({ error: 'CSV出力に失敗しました: ' + err.message });
  }
});

// GET /:yearMonth - ボーナス一覧
router.get('/:yearMonth', authMiddleware, (req, res) => {
  try {
    const { yearMonth } = req.params;

    if (req.user.is_admin) {
      const users = db
        .prepare('SELECT id, name, employee_id FROM users WHERE is_active = 1 AND is_admin = 0 ORDER BY employee_id')
        .all();

      const result = users.map(u => {
        const salesRows = db
          .prepare("SELECT * FROM sales_records WHERE user_id = ? AND record_date LIKE ?")
          .all(u.id, `${yearMonth}-%`);
        const total_sales = salesRows.reduce((s, r) => s + (r.sales_amount || 0), 0);
        const total_material = salesRows.reduce((s, r) => s + (r.material_cost || 0), 0);
        const total_profit = total_sales - total_material;

        const bonus = db
          .prepare('SELECT * FROM bonuses WHERE user_id = ? AND year_month = ?')
          .get(u.id, yearMonth);

        return {
          user_id: u.id,
          user_name: u.name,
          employee_id: u.employee_id,
          year_month: yearMonth,
          total_sales,
          total_material,
          total_profit,
          bonus_amount: bonus?.bonus_amount || 0,
          bonus_notes: bonus?.notes || null,
          bonus_id: bonus?.id || null,
        };
      });

      res.json(result);
    } else {
      // 従業員は自分のみ
      const u = db
        .prepare('SELECT id, name, employee_id FROM users WHERE id = ?')
        .get(req.user.id);

      const salesRows = db
        .prepare("SELECT * FROM sales_records WHERE user_id = ? AND record_date LIKE ?")
        .all(req.user.id, `${yearMonth}-%`);
      const total_sales = salesRows.reduce((s, r) => s + (r.sales_amount || 0), 0);
      const total_material = salesRows.reduce((s, r) => s + (r.material_cost || 0), 0);
      const total_profit = total_sales - total_material;

      const bonus = db
        .prepare('SELECT * FROM bonuses WHERE user_id = ? AND year_month = ?')
        .get(req.user.id, yearMonth);

      res.json([{
        user_id: req.user.id,
        user_name: u?.name,
        employee_id: u?.employee_id,
        year_month: yearMonth,
        total_sales,
        total_material,
        total_profit,
        bonus_amount: bonus?.bonus_amount || 0,
        bonus_notes: bonus?.notes || null,
        bonus_id: bonus?.id || null,
      }]);
    }
  } catch (err) {
    console.error('ボーナス一覧取得エラー:', err);
    res.status(500).json({ error: 'ボーナス一覧の取得に失敗しました: ' + err.message });
  }
});

// PUT /:yearMonth/:userId - ボーナス登録・更新（管理者のみ、UPSERT）
router.put('/:yearMonth/:userId', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { yearMonth, userId } = req.params;
    const { bonus_amount, notes } = req.body;

    const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(userId);
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

    db.prepare(
      `INSERT INTO bonuses (user_id, year_month, bonus_amount, notes, created_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, year_month) DO UPDATE SET
         bonus_amount = excluded.bonus_amount,
         notes = excluded.notes,
         updated_at = datetime('now','localtime')`
    ).run(
      parseInt(userId),
      yearMonth,
      bonus_amount || 0,
      notes || null,
      req.user.id
    );

    const result = db
      .prepare('SELECT * FROM bonuses WHERE user_id = ? AND year_month = ?')
      .get(userId, yearMonth);
    res.json(result);
  } catch (err) {
    console.error('ボーナス登録・更新エラー:', err);
    res.status(500).json({ error: 'ボーナスの登録・更新に失敗しました: ' + err.message });
  }
});

module.exports = router;
