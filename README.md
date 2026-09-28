# 地理の地球儀

ブラウザで回して使う、地理の学び直し用の3D地球儀です。

- **国名・首都**：国をクリックすると、国名（日本語・英語）、国旗、首都、属する大陸・地域を表示します。
- **国データの比較**：人口・面積・人口密度と、独立国197か国中の順位を表示します。「主題図」で国を色分けし、ランキング一覧も見られます。
- **地形・都市・緯線経線**：地形の陰影、主な山脈と山、河川、首都、赤道・回帰線・極圏・日付変更線・本初子午線、10°ごとの経緯線を重ねて表示します。

## 使い方

| 操作 | 方法 |
| --- | --- |
| 回す・拡大縮小 | ドラッグ、ホイール（スマホは1本指で回転、2本指で拡大縮小） |
| 国の情報を見る | 国をクリック、または上の検索欄に国名（日本語・英語）を入力 |
| 首都へ移動 | 情報パネルの首都名をクリック |
| 色分け | 「主題図」で人口・面積・人口密度を選ぶ |
| 表示の切り替え | 「表示」から国名・首都・山・河川・線を選ぶ |
| 共有 | 選んだ国はURLの `#JPN` のような部分に残る |

ズームすると、小さな国の名前や首都、山や川の名前が順に表示されます。

## 表記と境界の方針

日本の教科書・地図帳に合わせています。

- **国境**：Natural Earth の「日本視点版」を使っています。北方領土・竹島・尖閣諸島は日本、クリミアはウクライナとして描きます。
- **独立国の数**：日本が承認している195か国、日本、北朝鮮の計197か国です（[二宮書店の解説](https://www.ninomiyashoten.co.jp/chiri_q_and_a/q024)による教科書の数え方）。台湾・パレスチナ・西サハラなどは「地域」として扱います。
- **国名**：総務省統計局『世界の統計2026』の表記です。
- **首都名**：帝国書院の統計資料の表記です。例外として、カザフスタンは2022年に首都名がアスタナに戻ったため「アスタナ」とし、タンザニアは法律上の首都ドドマも併記しています。

## 開発

Node.js 22.12 以上が必要です。

```sh
npm install
npm run dev        # 開発サーバー http://localhost:5173/
npm test           # 単体テストと生成データの検査
npm run build      # 型チェックと本番ビルド（dist/）
npm run preview    # ビルド結果の確認
```

`public/data/` と `public/textures/` のファイルはスクリプトで生成し、リポジトリに含めています。元データを更新するときだけ、次を実行します。

```sh
npm run data       # Natural Earth と世界銀行から国・地形のデータを作る
npm run texture    # Natural Earth のラスターから地球の画像を作る
```

表記の修正などは `data/overrides/` のJSONで行います。各ファイルの `_note` と `_sources` に内容と出典を書いています。

## 公開（GitHub Pages）

`main` ブランチに push すると、`.github/workflows/deploy.yml` がテスト・ビルドをして GitHub Pages に公開します。初回だけ、リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選んでください。公開先は `https://<ユーザー名>.github.io/<リポジトリ名>/` です。公開時のパスはワークフローが GitHub Pages の設定から取得するため、リポジトリ名を変えてもコードの修正は要りません（変更後に一度、Actions から再公開してください）。

## データの出典

| 内容 | 出典 | ライセンス |
| --- | --- | --- |
| 国境・地形画像・都市・河川・山・緯線 | [Natural Earth](https://www.naturalearthdata.com/) v5.1.2（地形画像は v3.2.0） | パブリックドメイン |
| 人口（SP.POP.TOTL）・面積（AG.SRF.TOTL.K2） | [世界銀行 World Development Indicators](https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators) | CC BY 4.0 |
| 台湾の人口・面積、バチカンの面積、国名の表記 | [総務省統計局『世界の統計2026』](https://www.stat.go.jp/data/sekai/0116.html) | ― |
| 首都名 | [帝国書院 統計資料](https://www.teikokushoin.co.jp/statistics/country/) | ― |
| 河川の日本語名 | 日本語版Wikipediaの記事名（英語版からの言語間リンク） | ― |
| 国旗 | [flag-icons](https://github.com/lipis/flag-icons) | MIT |

同梱しているライブラリ（three.js、globe.gl、d3 など）のライセンスは、ビルド時に `dist/licenses.md` として出力し、画面の「出典」からリンクしています。
