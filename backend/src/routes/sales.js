'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../database');
const { authMiddleware, adminMiddleware } = require('../auth');

// Helper: add profit field to a record
function withProfit(record) {
  if (!record) return record;
  return {
    ...record,
    profit: (record.sales_amount || 0) - (record.material_cost || 0),
  };
}

// Helper: attach photo URLs to a sales record
function attachPhotos(record) {
  if (!record) return record;
  const photos = db
    .prepare('SELECT * FROM sales_photos WHERE sales_record_id = ?')
    .all(record.id);
  return {
    ...record,
    photos: photos.map(p => ({
      ...p,
      url: `/uploads/sales/${record.id}/${path.basename(p.file_path)}`,
    })),
  };
}

// GET / - 売上一覧
router.get('/', authMiddleware, (req, res) => {
  try {
    const { year_month, user_id } = req.query;
    let sql = 'SELECT sr.*, u.name as user_name, u.employee_id FROM sales_records sr JOIN users u ON sr.user_id = u.id WHERE 1=1';
    const params = [];

    if (!req.user.is_admin) {
      sql += ' AND sr.user_id = ?';
      params.push(req.user.id);
    } else if (user_id) {
      sql += ' AND sr.user_id = ?';
      params.push(parseInt(user_id));
    }

    if (year_month) {
      sql += ' AND sr.record_date LIKE ?';
      params.push(`${year_month}-%`);
    }

    sql += ' ORDER BY sr.record_date DESC';

    const records = db.prepare(sql).all(...params);
    const result = records.map(r => withProfit(attachPhotos(r)));
    res.json(result);
  } catch (err) {
    console.error('売上一覧取得エラー:', err);
    res.status(500).json({ error: '売上一覧の取得に失敗しました: ' + err.message });
  }
});

// GET /monthly/:yearMonth - 月次集計 ※具体的パスを先に定義
router.get('/monthly/:yearMonth', authMiddleware, (req, res) => {
  try {
    const { yearMonth } = req.params;

    if (req.user.is_admin) {
      const users = db.prepare('SELECT id, name, employee_id FROM users WHERE is_active = 1 AND is_admin = 0').all();
      const result = users.map(u => {
        const rows = db
          .prepare("SELECT * FROM sales_records WHERE user_id = ? AND record_date LIKE ?")
          .all(u.id, `${yearMonth}-%`);
        const total_sales = rows.reduce((s, r) => s + (r.sales_amount || 0), 0);
        const total_material = rows.reduce((s, r) => s + (r.material_cost || 0), 0);
        const total_profit = total_sales - total_material;
        return {
          user_id: u.id,
          user_name: u.name,
          employee_id: u.employee_id,
          year_month: yearMonth,
          total_sales,
          total_material,
          total_profit,
          record_count: rows.length,
        };
      });
      res.json(result);
    } else {
      const rows = db
        .prepare("SELECT * FROM sales_records WHERE user_id = ? AND record_date LIKE ?")
        .all(req.user.id, `${yearMonth}-%`);
      const total_sales = rows.reduce((s, r) => s + (r.sales_amount || 0), 0);
      const total_material = rows.reduce((s, r) => s + (r.material_cost || 0), 0);
      const total_profit = total_sales - total_material;
      res.json({
        user_id: req.user.id,
        year_month: yearMonth,
        total_sales,
        total_material,
        total_profit,
        record_count: rows.length,
      });
    }
  } catch (err) {
    console.error('月次集計エラー:', err);
    res.status(500).json({ error: '月次集計の取得に失敗しました: ' + err.message });
  }
});

// GET /export/:yearMonth - CSV出力（管理者のみ）※ /:id より前に定義
router.get('/export/:yearMonth', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { yearMonth } = req.params;
    const records = db
      .prepare(
        `SELECT sr.*, u.name as user_name, u.employee_id
         FROM sales_records sr
         JOIN users u ON sr.user_id = u.id
         WHERE sr.record_date LIKE ?
         ORDER BY u.employee_id, sr.record_date`
      )
      .all(`${yearMonth}-%`);

    const headers = ['社員番号', '氏名', '日付', '売上金額', '材料費', '利益', 'メモ'];
    const rows = records.map(r => [
      r.employee_id,
      r.user_name,
      r.record_date,
      r.sales_amount || 0,
      r.material_cost || 0,
      (r.sales_amount || 0) - (r.material_cost || 0),
      r.notes || '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sales_${yearMonth}.csv"`);
    res.send('﻿' + csv);
  } catch (err) {
    console.error('CSV出力エラー:', err);
    res.status(500).json({ error: 'CSV出力に失敗しました: ' + err.message });
  }
});

// DELETE /photos/:photoId - 写真削除（管理者のみ）※ /:id より前に定義
router.delete('/photos/:photoId', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { photoId } = req.params;
    const photo = db.prepare('SELECT * FROM sales_photos WHERE id = ?').get(photoId);
    if (!photo) return res.status(404).json({ error: '写真が見つかりません' });

    // ファイル削除
    if (fs.existsSync(photo.file_path)) {
      fs.unlinkSync(photo.file_path);
    }

    db.prepare('DELETE FROM sales_photos WHERE id = ?').run(photoId);
    res.json({ message: '写真を削除しました' });
  } catch (err) {
    console.error('写真削除エラー:', err);
    res.status(500).json({ error: '写真の削除に失敗しました: ' + err.message });
  }
});

// POST / - 売上記録作成（同一user_id+record_dateは上書き）
router.post('/', authMiddleware, (req, res) => {
  try {
    const { user_id, record_date, sales_amount, material_cost, notes } = req.body;
    if (!record_date) return res.status(400).json({ error: '日付は必須です' });

    const targetUserId = req.user.is_admin && user_id ? parseInt(user_id) : req.user.id;

    const result = db.prepare(
      `INSERT INTO sales_records (user_id, record_date, sales_amount, material_cost, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      targetUserId,
      record_date,
      sales_amount || 0,
      material_cost || 0,
      notes || null,
      req.user.id
    );

    const record = db.prepare('SELECT * FROM sales_records WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(withProfit(attachPhotos(record)));
  } catch (err) {
    console.error('売上記録作成エラー:', err);
    res.status(500).json({ error: '売上記録の作成に失敗しました: ' + err.message });
  }
});

// PUT /:id - 更新
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare('SELECT * FROM sales_records WHERE id = ?').get(id);
    if (!record) return res.status(404).json({ error: '売上記録が見つかりません' });

    if (!req.user.is_admin && record.user_id !== req.user.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const { sales_amount, material_cost, notes, record_date } = req.body;
    db.prepare(
      `UPDATE sales_records SET
         sales_amount = ?,
         material_cost = ?,
         notes = ?,
         record_date = ?,
         updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      sales_amount ?? record.sales_amount,
      material_cost ?? record.material_cost,
      notes !== undefined ? notes : record.notes,
      record_date || record.record_date,
      id
    );

    const updated = db.prepare('SELECT * FROM sales_records WHERE id = ?').get(id);
    res.json(withProfit(attachPhotos(updated)));
  } catch (err) {
    console.error('売上記録更新エラー:', err);
    res.status(500).json({ error: '売上記録の更新に失敗しました: ' + err.message });
  }
});

// DELETE /:id - 削除（管理者のみ）
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare('SELECT * FROM sales_records WHERE id = ?').get(id);
    if (!record) return res.status(404).json({ error: '売上記録が見つかりません' });

    // 関連写真を削除
    const photos = db.prepare('SELECT * FROM sales_photos WHERE sales_record_id = ?').all(id);
    for (const photo of photos) {
      if (fs.existsSync(photo.file_path)) fs.unlinkSync(photo.file_path);
    }
    db.prepare('DELETE FROM sales_photos WHERE sales_record_id = ?').run(id);
    db.prepare('DELETE FROM sales_records WHERE id = ?').run(id);

    res.json({ message: '売上記録を削除しました' });
  } catch (err) {
    console.error('売上記録削除エラー:', err);
    res.status(500).json({ error: '売上記録の削除に失敗しました: ' + err.message });
  }
});

// POST /:id/photos - 写真アップロード（max 3枚、画像のみ）
router.post('/:id/photos', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare('SELECT * FROM sales_records WHERE id = ?').get(id);
    if (!record) return res.status(404).json({ error: '売上記録が見つかりません' });

    if (!req.user.is_admin && record.user_id !== req.user.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads', 'sales', String(id));
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      },
    });

    const upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('画像ファイルのみアップロードできます'));
        }
      },
    });

    // 既存写真数チェック用のミドルウェア
    const uploadMiddleware = upload.array('photos', 3);

    uploadMiddleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const existingCount = db
        .prepare('SELECT COUNT(*) as cnt FROM sales_photos WHERE sales_record_id = ?')
        .get(id)?.cnt || 0;

      const files = req.files || [];
      if (existingCount + files.length > 3) {
        // 超過ファイルを削除
        for (const f of files) {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        }
        return res.status(400).json({ error: '写真は最大3枚までです（現在 ' + existingCount + ' 枚）' });
      }

      const inserted = [];
      for (const file of files) {
        db.prepare(
          'INSERT INTO sales_photos (sales_record_id, file_path, original_name) VALUES (?, ?, ?)'
        ).run(id, file.path, file.originalname);
        const lastId = db.prepare('SELECT last_insert_rowid() as lid').get()?.lid;
        inserted.push({
          id: lastId,
          sales_record_id: parseInt(id),
          file_path: file.path,
          original_name: file.originalname,
          url: `/uploads/sales/${id}/${file.filename}`,
        });
      }

      res.status(201).json(inserted);
    });
  } catch (err) {
    console.error('写真アップロードエラー:', err);
    res.status(500).json({ error: '写真のアップロードに失敗しました: ' + err.message });
  }
});

module.exports = router;
