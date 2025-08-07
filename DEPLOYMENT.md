# 機票價格追蹤工具 - 部署指南

## 概述

這是一個整合到 GPT AI Assistant 中的機票價格追蹤工具，提供以下功能：

- 🔍 搜尋多個來源的機票價格
- 📊 追蹤價格變化趨勢
- 🔔 價格警報和通知
- 📈 價格分析和建議
- 🌐 網頁介面和 LINE Bot 整合

## 架構組件

### 後端服務
1. **FlightScraper** (`/services/flight-scraper.js`) - 機票資料抓取
2. **FlightDatabase** (`/storage/flight-database.js`) - SQLite 資料庫管理
3. **FlightTracker** (`/services/flight-tracker.js`) - 主要追蹤服務
4. **NotificationService** (`/services/notification-service.js`) - LINE 通知服務

### API 路由
- **FlightRoutes** (`/api/flight-routes.js`) - REST API 端點

### 前端
- **Web Interface** (`/public/index.html`) - 網頁管理介面

### LINE Bot 整合
- **Flight Commands** (`/app/commands/flight.js`) - LINE Bot 命令處理

## 安裝步驟

### 1. 安裝依賴項

```bash
npm install
```

必要的新增依賴項：
- `cheerio` - HTML 解析
- `node-cron` - 排程任務
- `puppeteer` - 網頁抓取
- `sqlite3` - 資料庫

### 2. 環境變數設定

確保 `.env` 檔案包含：

```env
# LINE Bot 設定
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# 應用程式設定
APP_PORT=3000
APP_URL=https://your-domain.com

# Webhook 設定
APP_WEBHOOK_PATH=/webhook
```

### 3. 資料庫初始化

資料庫會在首次啟動時自動建立，包含以下表格：
- `flight_routes` - 航班路線
- `price_history` - 價格歷史記錄
- `user_subscriptions` - 用戶訂閱
- `price_alerts` - 價格警報

### 4. 啟動服務

開發環境：
```bash
npm run dev
```

生產環境：
```bash
npm start
```

## 功能使用

### LINE Bot 命令

#### 搜尋機票
```
/flight search TPE NRT 2024-03-15
/flight search TPE NRT 2024-03-15 2024-03-20
```

#### 追蹤機票價格
```
/flight track TPE NRT 2024-03-15
/flight track TPE NRT 2024-03-15 15000
/flight track TPE NRT 2024-03-15 15000 2024-03-20
```

#### 查看追蹤列表
```
/flight list
```

#### 移除追蹤
```
/flight remove [訂閱ID]
```

#### 價格分析
```
/flight analysis [路線ID]
```

#### 機場代碼查詢
```
/flight airports 台北
/flight airports 東京
```

### Web 介面

訪問 `http://localhost:3000` 使用網頁介面：

1. **搜尋機票** - 即時搜尋航班價格
2. **我的追蹤** - 管理價格追蹤列表
3. **價格分析** - 查看價格趨勢和建議

### API 使用

#### 搜尋機票
```bash
curl -X POST http://localhost:3000/api/flights/search \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "TPE",
    "destination": "NRT", 
    "departureDate": "2024-03-15",
    "passengers": 1
  }'
```

#### 添加追蹤
```bash
curl -X POST http://localhost:3000/api/flights/track \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "origin": "TPE",
    "destination": "NRT",
    "departureDate": "2024-03-15",
    "maxPrice": 15000
  }'
```

#### 查看追蹤列表
```bash
curl http://localhost:3000/api/flights/trackings/user123
```

## 排程任務

系統會自動執行以下排程任務：

### 每小時價格檢查
- 時間：每小時整點
- 功能：檢查所有追蹤路線的最新價格
- 範例：`0 * * * *`

### 每日價格警報
- 時間：每天早上 8:00
- 功能：檢查價格變化並發送警報
- 範例：`0 8 * * *`

### 每日價格摘要
- 時間：每天晚上 9:00
- 功能：發送每日價格摘要給用戶
- 範例：`0 21 * * *`

## 支援的機場

### 台灣
- TPE - 桃園國際機場
- TSA - 台北松山機場
- RMQ - 台中清泉崗機場
- KHH - 高雄小港機場

### 國際主要機場
- NRT/HND - 東京機場
- KIX - 大阪關西機場
- ICN - 首爾仁川機場
- HKG - 香港國際機場
- SIN - 新加坡樟宜機場
- BKK - 曼谷蘇萬那普機場

## 資料來源整合

目前實作包含模擬資料來源：
- Skyscanner (示例實作)
- Kayak (示例實作)
- Expedia (示例實作)

### 實際部署注意事項

1. **API 金鑰**: 實際部署時需要註冊各機票網站的 API
2. **頻率限制**: 注意各 API 的請求限制
3. **反爬蟲**: 使用 Puppeteer 時注意目標網站的反爬蟲機制

## 監控和日誌

### 日誌位置
- 主要日誌：console 輸出
- 錯誤日誌：包含詳細錯誤資訊

### 監控指標
- 成功搜尋率
- API 回應時間
- 資料庫大小
- 活躍追蹤數量

## 故障排除

### 常見問題

#### 1. 資料庫連接錯誤
```
Error: SQLITE_CANTOPEN: unable to open database file
```
**解決方案**: 確保 `storage/` 目錄存在且有寫入權限

#### 2. LINE API 錯誤
```
Error 401: Unauthorized
```
**解決方案**: 檢查 `LINE_CHANNEL_ACCESS_TOKEN` 是否正確

#### 3. Puppeteer 啟動失敗
```
Error: Failed to launch the browser process
```
**解決方案**: 安裝必要的系統依賴：
```bash
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

### 效能優化

#### 1. 資料庫優化
- 定期清理舊價格記錄
- 為常用查詢添加索引

#### 2. 快取機制
- 考慮添加 Redis 快取熱門路線
- 實作請求去重

#### 3. 併發控制
- 限制同時進行的搜尋請求數量
- 實作請求佇列

## 開發和測試

### 本地開發
```bash
npm run dev
```

### 測試命令
```bash
npm test
```

### API 測試
使用提供的 Postman collection 或 curl 命令測試 API 端點

## 部署建議

### Docker 部署
現有的 `Dockerfile` 和 `docker-compose.yaml` 已更新以支援新功能

### 雲端部署
- 推薦使用 PM2 進行進程管理
- 設定適當的環境變數
- 配置負載平衡器（如有需要）

### 監控和維護
- 設定日誌輪轉
- 定期備份資料庫
- 監控系統資源使用

## 授權

本專案採用 MIT 授權條款