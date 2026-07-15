-- 取引先データ一括取込（会社 + 事業所）
-- 既に同名の会社が存在する場合は住所を上書きせず、事業所だけ追加します。何度実行しても重複しません。

-- 株式会社 MJI
INSERT INTO companies (name, postal, address)
SELECT '株式会社 MJI', '491-0123', '愛知県一宮市富塚字起畠1丁目1番地'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社 MJI');

-- RADONE株式会社
INSERT INTO companies (name, postal, address)
SELECT 'RADONE株式会社', '921-8044', '石川県金沢市米泉町10-1-156 SEASON817 A棟101号'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'RADONE株式会社');

-- 社会福祉法人 福祥福祉会
INSERT INTO companies (name, postal, address)
SELECT '社会福祉法人 福祥福祉会', '560-0001', '大阪府豊中市北緑丘2丁目9-5'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '社会福祉法人 福祥福祉会');

-- 株式会社イノセンツ
INSERT INTO companies (name, postal, address)
SELECT '株式会社イノセンツ', '464-0032', '愛知県名古屋市千種区猫洞通4-26 アルヴィ猫洞2F'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社イノセンツ');

-- 株式会社クリップコーポレーション
INSERT INTO companies (name)
SELECT '株式会社クリップコーポレーション'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社クリップコーポレーション');
INSERT INTO company_offices (company_id, name, postal, address)
SELECT c.id, '中村公園校', '464-0075', '名古屋市千種区内山三丁目18番10号 千種ステーションビル7F' FROM companies c WHERE c.name = '株式会社クリップコーポレーション'
AND NOT EXISTS (SELECT 1 FROM company_offices co WHERE co.company_id = c.id AND co.name = '中村公園校');

-- 株式会社 ケーアンドイー
INSERT INTO companies (name, postal, address)
SELECT '株式会社 ケーアンドイー', '465-0025', '愛知県名古屋市名東区上社2丁目199番地 第5日吉ビル1階'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社 ケーアンドイー');

-- サンハイツ城山パークⅠ 管理組合
INSERT INTO companies (name, postal, address)
SELECT 'サンハイツ城山パークⅠ 管理組合', '485-0812', '愛知県小牧市城山3丁目17-1'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'サンハイツ城山パークⅠ 管理組合');

-- 株式会社 シッククリエーション
INSERT INTO companies (name, postal, address)
SELECT '株式会社 シッククリエーション', '461-0002', '愛知県名古屋市東区代官町40番18号 ALA代官町ビル4階'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社 シッククリエーション');

-- ニュートリー株式会社
INSERT INTO companies (name, postal, address)
SELECT 'ニュートリー株式会社', '510-0013', '三重県四日市市富士町 1-122'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'ニュートリー株式会社');

-- 有限会社ファイン・ライトサービス
INSERT INTO companies (name, postal, address)
SELECT '有限会社ファイン・ライトサービス', '464-0856', '愛知県名古屋市千種区吹上1-5-4'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '有限会社ファイン・ライトサービス');

-- プリンス本店
INSERT INTO companies (name, postal, address)
SELECT 'プリンス本店', '444-0068', '愛知県岡崎市井田南町7－7'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'プリンス本店');

-- ヘアーサロンマハロ
INSERT INTO companies (name, postal, address)
SELECT 'ヘアーサロンマハロ', '474-0046', '愛知県大府市吉川町2丁目30'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'ヘアーサロンマハロ');

-- 株式会社ロイヤル
INSERT INTO companies (name, postal, address)
SELECT '株式会社ロイヤル', '472-0024', '愛知県知立市宝町塩掻58'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社ロイヤル');

-- 株式会社ワールドネットワーク
INSERT INTO companies (name, postal, address)
SELECT '株式会社ワールドネットワーク', '465-0093', '愛知県名古屋市名東区一社3丁目105番地1'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社ワールドネットワーク');

-- 三田サミットホテル
INSERT INTO companies (name, postal, address)
SELECT '三田サミットホテル', '669-1544', '兵庫県三田市武庫が丘7丁目2-1'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '三田サミットホテル');

-- 中電クラビス株式会社
INSERT INTO companies (name, postal, address)
SELECT '中電クラビス株式会社', '460-0008', '愛知県名古屋市中区栄二丁目２番５号 電気文化会館11階'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '中電クラビス株式会社');

-- 株式会社学生情報センター
INSERT INTO companies (name, postal, address)
SELECT '株式会社学生情報センター', '600-8216', '京都府京都市下京区鳥丸通七条下ル ニッセイ京都駅前ビル6Ｆ'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社学生情報センター');

-- 新日本パワーサプライ株式会社
INSERT INTO companies (name, postal, address)
SELECT '新日本パワーサプライ株式会社', '732-0824', '広島市南区的場町一丁目2番21号 広島第一生命OSビルディング8F'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '新日本パワーサプライ株式会社');

-- 日本セイフティー株式会社
INSERT INTO companies (name)
SELECT '日本セイフティー株式会社'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '日本セイフティー株式会社');
INSERT INTO company_offices (company_id, name, postal, address)
SELECT c.id, '名古屋', '496-0026', '愛知県津島市唐臼町二ツ池60' FROM companies c WHERE c.name = '日本セイフティー株式会社'
AND NOT EXISTS (SELECT 1 FROM company_offices co WHERE co.company_id = c.id AND co.name = '名古屋');
INSERT INTO company_offices (company_id, name, postal, address)
SELECT c.id, '兵庫東条機材センター', '673-1304', '兵庫県加東市長貞1823‐1' FROM companies c WHERE c.name = '日本セイフティー株式会社'
AND NOT EXISTS (SELECT 1 FROM company_offices co WHERE co.company_id = c.id AND co.name = '兵庫東条機材センター');
INSERT INTO company_offices (company_id, name, postal, address)
SELECT c.id, '千葉機材センター', '102-0082', '東京都千代田区一番町21番 一番東急ビル11F' FROM companies c WHERE c.name = '日本セイフティー株式会社'
AND NOT EXISTS (SELECT 1 FROM company_offices co WHERE co.company_id = c.id AND co.name = '千葉機材センター');
INSERT INTO company_offices (company_id, name, postal, address)
SELECT c.id, '滋賀機材センター', '523-0072', '滋賀県近江八幡市牧町岡田2102' FROM companies c WHERE c.name = '日本セイフティー株式会社'
AND NOT EXISTS (SELECT 1 FROM company_offices co WHERE co.company_id = c.id AND co.name = '滋賀機材センター');

-- 日本鉄筋工事株式会社
INSERT INTO companies (name, postal, address)
SELECT '日本鉄筋工事株式会社', '464-0013', '愛知県名古屋市千種区汁谷町7番地'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '日本鉄筋工事株式会社');

-- 医療法人 社団同潤会 眼科杉田病院
INSERT INTO companies (name, postal, address)
SELECT '医療法人 社団同潤会 眼科杉田病院', '460-0008', '愛知県名古屋市中区栄5丁目1番地30号'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '医療法人 社団同潤会 眼科杉田病院');

-- 株式会社 大丸
INSERT INTO companies (name, postal, address)
SELECT '株式会社 大丸', '464-0044', '愛知県名古屋市昭和区桜山町５丁目９６'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社 大丸');

-- 株式会社清水屋
INSERT INTO companies (name)
SELECT '株式会社清水屋'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社清水屋');
INSERT INTO company_offices (company_id, name, postal, address)
SELECT c.id, '森山', '463-8533', '名古屋市守山区森孝東一丁目509番地' FROM companies c WHERE c.name = '株式会社清水屋'
AND NOT EXISTS (SELECT 1 FROM company_offices co WHERE co.company_id = c.id AND co.name = '森山');
INSERT INTO company_offices (company_id, name, postal, address)
SELECT c.id, '本社', '486-8577', '愛知県春日井市瑞穂通五丁目33番地' FROM companies c WHERE c.name = '株式会社清水屋'
AND NOT EXISTS (SELECT 1 FROM company_offices co WHERE co.company_id = c.id AND co.name = '本社');

-- 竜泉寺の湯
INSERT INTO companies (name)
SELECT '竜泉寺の湯'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '竜泉寺の湯');
INSERT INTO company_offices (company_id, name, postal, address)
SELECT c.id, '豊田浄水店', '470-0343', '愛知県豊田市浄水町伊保原376' FROM companies c WHERE c.name = '竜泉寺の湯'
AND NOT EXISTS (SELECT 1 FROM company_offices co WHERE co.company_id = c.id AND co.name = '豊田浄水店');

-- 野瀬電気
INSERT INTO companies (name, postal, address)
SELECT '野瀬電気', '452-0962', '愛知県清須市春日焼田40 プロニティ103'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '野瀬電気');

-- 株式会社金沢有馬
INSERT INTO companies (name, postal, address)
SELECT '株式会社金沢有馬', '920-0849', '石川県金沢市堀川新町5－1'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社金沢有馬');

-- 株式会社 青楽
INSERT INTO companies (name, postal, address)
SELECT '株式会社 青楽', '483-8271', '愛知県 江南市 古知野町桃源59 第二サンライズビル2階'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '株式会社 青楽');

