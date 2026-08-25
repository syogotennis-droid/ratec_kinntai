-- work_records.work_type に「時間休」(hourly_leave) を追加できるようにする。
-- 既にSupabase側で追加済みの場合は何も変わらない(念のため実行しても安全)。
ALTER TABLE work_records DROP CONSTRAINT IF EXISTS work_records_work_type_check;
ALTER TABLE work_records ADD CONSTRAINT work_records_work_type_check
  CHECK (work_type IN ('normal', 'overtime', 'holiday', 'training', 'paid_leave', 'hourly_leave'));
