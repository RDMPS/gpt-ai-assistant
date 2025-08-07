# GPT AI Assistant with Flight Price Tracker

<div align="center">

[![license](https://img.shields.io/pypi/l/ansicolortags.svg)](LICENSE) [![Release](https://img.shields.io/github/release/memochou1993/gpt-ai-assistant)](https://GitHub.com/memochou1993/gpt-ai-assistant/releases/)

</div>

GPT AI Assistant is an application that is implemented using the OpenAI API and LINE Messaging API. Through the installation process, you can start chatting with your own AI assistant using the LINE mobile app.

## ✈️ New Feature: Flight Price Tracker

The latest version now includes a comprehensive flight price tracking system that helps users monitor airfare changes and find the best deals.

### Features

- 🔍 **Flight Search**: Search for flights across multiple sources
- 📊 **Price Tracking**: Monitor price changes over time
- 🔔 **Price Alerts**: Get notified when prices drop or reach your target
- 📈 **Price Analysis**: View price trends and recommendations
- 🌐 **Web Interface**: User-friendly web dashboard
- 🤖 **LINE Bot Integration**: Control everything through LINE commands

### Flight Tracking Commands

#### LINE Bot Commands

- `/flight search [起點] [終點] [日期]` - 搜尋機票
- `/flight track [起點] [終點] [日期] [價格上限]` - 追蹤機票價格
- `/flight list` - 查看追蹤列表
- `/flight remove [編號]` - 移除追蹤
- `/flight analysis [路線ID]` - 查看價格分析
- `/flight airports [查詢]` - 查詢機場代碼

#### Examples

```
/flight search TPE NRT 2024-03-15
/flight track TPE NRT 2024-03-15 15000
/flight airports 台北
```

### Web Interface

Access the flight tracker web interface at `http://your-domain/` after installation.

### API Endpoints

- `POST /api/flights/search` - Search flights
- `POST /api/flights/track` - Add price tracking
- `GET /api/flights/trackings/:userId` - Get user trackings
- `DELETE /api/flights/trackings/:userId/:subscriptionId` - Remove tracking
- `GET /api/flights/analysis/:routeId` - Get price analysis
- `GET /api/flights/airports/suggest` - Get airport suggestions

## News

- GPT AI Assistant v4 now support `gpt-3.5-turbo` language model. 🔥
- ✈️ **NEW**: Flight Price Tracker with real-time monitoring and alerts! 🚀

## Demo

<img src="/demo/labot.png" width="300"/>

## Installation & Setup

### Dependencies

The flight tracker requires additional dependencies:

```bash
npm install cheerio node-cron puppeteer sqlite3
```

### Database

The system automatically creates SQLite tables for:
- Flight routes
- Price history
- User subscriptions
- Price alerts

### Configuration

Make sure your `.env` file includes:

```env
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
APP_PORT=3000
```

## Flight Tracker Architecture

### Components

1. **FlightScraper** - Handles flight data collection from multiple sources
2. **FlightDatabase** - SQLite database for storing flight and price data
3. **FlightTracker** - Main service coordinating search, tracking, and alerts
4. **NotificationService** - Handles LINE message notifications
5. **Web Interface** - React-based dashboard for managing trackings

### Data Flow

1. User adds flight tracking via LINE bot or web interface
2. System stores route information and user preferences
3. Scheduled jobs search for updated prices
4. Price changes trigger alerts via LINE messages
5. Daily summaries provide overview of all tracked routes

### Scheduled Tasks

- **Hourly**: Price checking for all tracked routes
- **Daily 8 AM**: Price alert notifications
- **Daily 9 PM**: Daily summary reports

## API Usage Examples

### Search Flights

```javascript
const response = await fetch('/api/flights/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    origin: 'TPE',
    destination: 'NRT',
    departureDate: '2024-03-15',
    passengers: 1
  })
});
```

### Add Tracking

```javascript
const response = await fetch('/api/flights/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    origin: 'TPE',
    destination: 'NRT',
    departureDate: '2024-03-15',
    maxPrice: 15000
  })
});
```

## Supported Airports

The system includes major airports worldwide, with focus on Taiwan and Asia-Pacific routes:

- **Taiwan**: TPE (桃園), TSA (松山), RMQ (台中), KHH (高雄)
- **Japan**: NRT (成田), HND (羽田), KIX (關西)
- **Korea**: ICN (仁川)
- **Hong Kong**: HKG (香港)
- **Singapore**: SIN (樟宜)
- **Thailand**: BKK (曼谷)

## Documentations

- <a href="https://memochou1993.github.io/gpt-ai-assistant-docs/" target="_blank">中文</a>
- <a href="https://memochou1993.github.io/gpt-ai-assistant-docs/en" target="_blank">English</a>

## Credits

- [jayer95](https://github.com/jayer95) - Debugging and testing
- [kkdai](https://github.com/kkdai) - Idea of "sum" command
- [Dayu0815](https://github.com/Dayu0815) - Idea of "search" command
- [All other contributors](https://github.com/memochou1993/gpt-ai-assistant/graphs/contributors)

## Contact

If there is any question, please contact me at memochou1993@gmail.com. Thank you.

## Changelog

Detailed changes for each release are documented in the [release notes](https://github.com/memochou1993/gpt-ai-assistant/releases).

## License

[MIT](LICENSE)
