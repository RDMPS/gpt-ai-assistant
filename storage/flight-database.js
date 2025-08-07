import sqlite3 from 'sqlite3';
import { promisify } from 'util';

class FlightDatabase {
  constructor(dbPath = './storage/flights.db') {
    this.db = new sqlite3.Database(dbPath);
    this.run = promisify(this.db.run.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));
    this.initDatabase();
  }

  async initDatabase() {
    try {
      // 建立航班路線表
      await this.run(`
        CREATE TABLE IF NOT EXISTS flight_routes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          origin TEXT NOT NULL,
          destination TEXT NOT NULL,
          departure_date TEXT NOT NULL,
          return_date TEXT,
          passengers INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(origin, destination, departure_date, return_date, passengers)
        )
      `);

      // 建立價格歷史表
      await this.run(`
        CREATE TABLE IF NOT EXISTS price_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          route_id INTEGER NOT NULL,
          airline TEXT,
          price REAL NOT NULL,
          currency TEXT DEFAULT 'TWD',
          flight_time TEXT,
          stops INTEGER DEFAULT 0,
          booking_url TEXT,
          scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (route_id) REFERENCES flight_routes (id)
        )
      `);

      // 建立用戶訂閱表
      await this.run(`
        CREATE TABLE IF NOT EXISTS user_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          route_id INTEGER NOT NULL,
          max_price REAL,
          notification_enabled INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (route_id) REFERENCES flight_routes (id)
        )
      `);

      // 建立價格警報表
      await this.run(`
        CREATE TABLE IF NOT EXISTS price_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subscription_id INTEGER NOT NULL,
          old_price REAL,
          new_price REAL NOT NULL,
          price_change REAL,
          alert_type TEXT DEFAULT 'price_drop',
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id)
        )
      `);

      console.log('Flight database initialized successfully');
    } catch (error) {
      console.error('Error initializing flight database:', error);
      throw error;
    }
  }

  // 新增或獲取航班路線
  async getOrCreateRoute(origin, destination, departureDate, returnDate = null, passengers = 1) {
    try {
      let route = await this.get(`
        SELECT id FROM flight_routes 
        WHERE origin = ? AND destination = ? AND departure_date = ? 
        AND return_date = ? AND passengers = ?
      `, [origin, destination, departureDate, returnDate, passengers]);

      if (!route) {
        const result = await this.run(`
          INSERT INTO flight_routes (origin, destination, departure_date, return_date, passengers)
          VALUES (?, ?, ?, ?, ?)
        `, [origin, destination, departureDate, returnDate, passengers]);
        return result.lastID;
      }

      return route.id;
    } catch (error) {
      console.error('Error creating/getting route:', error);
      throw error;
    }
  }

  // 新增價格記錄
  async addPriceRecord(routeId, priceData) {
    try {
      const { airline, price, currency = 'TWD', flightTime, stops = 0, bookingUrl } = priceData;
      
      await this.run(`
        INSERT INTO price_history (route_id, airline, price, currency, flight_time, stops, booking_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [routeId, airline, price, currency, flightTime, stops, bookingUrl]);

      console.log(`Price record added: ${airline} - $${price} ${currency}`);
    } catch (error) {
      console.error('Error adding price record:', error);
      throw error;
    }
  }

  // 獲取最新價格
  async getLatestPrices(routeId, limit = 10) {
    try {
      return await this.all(`
        SELECT * FROM price_history 
        WHERE route_id = ? 
        ORDER BY scraped_at DESC 
        LIMIT ?
      `, [routeId, limit]);
    } catch (error) {
      console.error('Error getting latest prices:', error);
      throw error;
    }
  }

  // 獲取價格趨勢
  async getPriceTrend(routeId, days = 30) {
    try {
      return await this.all(`
        SELECT DATE(scraped_at) as date, MIN(price) as min_price, AVG(price) as avg_price, MAX(price) as max_price
        FROM price_history 
        WHERE route_id = ? AND scraped_at >= datetime('now', '-${days} days')
        GROUP BY DATE(scraped_at)
        ORDER BY date DESC
      `, [routeId]);
    } catch (error) {
      console.error('Error getting price trend:', error);
      throw error;
    }
  }

  // 新增用戶訂閱
  async addUserSubscription(userId, routeId, maxPrice = null) {
    try {
      await this.run(`
        INSERT OR REPLACE INTO user_subscriptions (user_id, route_id, max_price)
        VALUES (?, ?, ?)
      `, [userId, routeId, maxPrice]);

      console.log(`User subscription added: ${userId} for route ${routeId}`);
    } catch (error) {
      console.error('Error adding user subscription:', error);
      throw error;
    }
  }

  // 獲取用戶訂閱
  async getUserSubscriptions(userId) {
    try {
      return await this.all(`
        SELECT s.*, r.origin, r.destination, r.departure_date, r.return_date, r.passengers
        FROM user_subscriptions s
        JOIN flight_routes r ON s.route_id = r.id
        WHERE s.user_id = ? AND s.notification_enabled = 1
      `, [userId]);
    } catch (error) {
      console.error('Error getting user subscriptions:', error);
      throw error;
    }
  }

  // 檢查價格警報
  async checkPriceAlerts() {
    try {
      const subscriptions = await this.all(`
        SELECT s.*, r.origin, r.destination, r.departure_date
        FROM user_subscriptions s
        JOIN flight_routes r ON s.route_id = r.id
        WHERE s.notification_enabled = 1
      `);

      const alerts = [];

      for (const subscription of subscriptions) {
        const latestPrices = await this.getLatestPrices(subscription.route_id, 5);
        
        if (latestPrices.length > 0) {
          const currentPrice = latestPrices[0].price;
          
          // 檢查是否低於用戶設定的最高價格
          if (subscription.max_price && currentPrice <= subscription.max_price) {
            alerts.push({
              userId: subscription.user_id,
              route: `${subscription.origin} → ${subscription.destination}`,
              departureDate: subscription.departure_date,
              currentPrice: currentPrice,
              maxPrice: subscription.max_price,
              airline: latestPrices[0].airline,
              alertType: 'price_target_reached'
            });
          }

          // 檢查價格下降
          if (latestPrices.length >= 2) {
            const previousPrice = latestPrices[1].price;
            const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
            
            if (priceChange <= -10) { // 價格下降超過10%
              alerts.push({
                userId: subscription.user_id,
                route: `${subscription.origin} → ${subscription.destination}`,
                departureDate: subscription.departure_date,
                currentPrice: currentPrice,
                previousPrice: previousPrice,
                priceChange: priceChange.toFixed(2),
                airline: latestPrices[0].airline,
                alertType: 'price_drop'
              });
            }
          }
        }
      }

      return alerts;
    } catch (error) {
      console.error('Error checking price alerts:', error);
      throw error;
    }
  }

  // 關閉資料庫連接
  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

export default FlightDatabase;