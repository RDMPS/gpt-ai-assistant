import FlightScraper from './flight-scraper.js';
import FlightDatabase from '../storage/flight-database.js';
import NotificationService from './notification-service.js';
import cron from 'node-cron';

class FlightTracker {
  constructor() {
    this.scraper = new FlightScraper();
    this.database = new FlightDatabase();
    this.notificationService = new NotificationService();
    this.trackingJobs = new Map();
    this.isRunning = false;
  }

  // 啟動價格追蹤系統
  async start() {
    if (this.isRunning) {
      console.log('Flight tracker is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting flight price tracker...');

    // 每小時檢查一次價格
    cron.schedule('0 * * * *', async () => {
      console.log('Running scheduled price check...');
      await this.runPriceCheck();
    });

    // 每天早上8點檢查價格警報
    cron.schedule('0 8 * * *', async () => {
      console.log('Running daily price alerts check...');
      await this.checkAndSendAlerts();
    });

    // 每天晚上9點發送每日摘要
    cron.schedule('0 21 * * *', async () => {
      console.log('Sending daily price summaries...');
      await this.sendDailySummaries();
    });

    console.log('Flight tracker started successfully');
  }

  // 停止追蹤系統
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.trackingJobs.clear();
    await this.scraper.closeBrowser();
    console.log('Flight tracker stopped');
  }

  // 添加新的航班路線追蹤
  async addFlightTracking(userId, searchParams, maxPrice = null) {
    try {
      const { origin, destination, departureDate, returnDate, passengers } = searchParams;
      
      // 驗證搜尋參數
      this.scraper.validateSearchParams(searchParams);
      
      // 獲取或建立路線
      const routeId = await this.database.getOrCreateRoute(
        origin, destination, departureDate, returnDate, passengers
      );

      // 添加用戶訂閱
      await this.database.addUserSubscription(userId, routeId, maxPrice);

      // 立即執行一次價格搜尋
      await this.searchAndSavePrices(routeId, searchParams);

      console.log(`Flight tracking added for user ${userId}: ${origin} → ${destination}`);
      
      return {
        success: true,
        routeId,
        message: '機票價格追蹤已設定完成'
      };
    } catch (error) {
      console.error('Error adding flight tracking:', error);
      throw error;
    }
  }

  // 搜尋並儲存價格
  async searchAndSavePrices(routeId, searchParams) {
    try {
      console.log(`Searching prices for route ${routeId}...`);
      
      const flights = await this.scraper.searchFlights(searchParams);
      
      if (flights.length === 0) {
        console.log(`No flights found for route ${routeId}`);
        return [];
      }

      // 儲存價格記錄
      for (const flight of flights) {
        await this.database.addPriceRecord(routeId, flight);
      }

      console.log(`Saved ${flights.length} price records for route ${routeId}`);
      return flights;
    } catch (error) {
      console.error(`Error searching/saving prices for route ${routeId}:`, error);
      throw error;
    }
  }

  // 執行價格檢查 (所有追蹤的路線)
  async runPriceCheck() {
    try {
      // 獲取所有活躍的訂閱
      const subscriptions = await this.database.all(`
        SELECT DISTINCT r.*, COUNT(s.id) as subscriber_count
        FROM flight_routes r
        JOIN user_subscriptions s ON r.id = s.route_id
        WHERE s.notification_enabled = 1
        AND date(r.departure_date) >= date('now')
        GROUP BY r.id
      `);

      console.log(`Checking prices for ${subscriptions.length} routes...`);

      for (const route of subscriptions) {
        try {
          const searchParams = {
            origin: route.origin,
            destination: route.destination,
            departureDate: route.departure_date,
            returnDate: route.return_date,
            passengers: route.passengers
          };

          await this.searchAndSavePrices(route.id, searchParams);
          
          // 避免請求太頻繁
          await this.delay(2000);
        } catch (error) {
          console.error(`Error checking route ${route.id}:`, error);
          continue;
        }
      }

      console.log('Price check completed');
    } catch (error) {
      console.error('Error running price check:', error);
    }
  }

  // 檢查並發送價格警報
  async checkAndSendAlerts() {
    try {
      const alerts = await this.database.checkPriceAlerts();
      
      console.log(`Found ${alerts.length} price alerts`);

      for (const alert of alerts) {
        await this.notificationService.sendFlightPriceAlert(alert);
      }
    } catch (error) {
      console.error('Error checking price alerts:', error);
    }
  }

  // 發送每日價格摘要
  async sendDailySummaries() {
    try {
      // 獲取所有有活躍追蹤的用戶
      const users = await this.database.all(`
        SELECT DISTINCT user_id 
        FROM user_subscriptions 
        WHERE notification_enabled = 1
      `);

      for (const user of users) {
        const trackings = await this.getUserTrackings(user.user_id);
        if (trackings.length > 0) {
          await this.notificationService.sendDailySummary(user.user_id, trackings);
          await this.delay(200); // 避免 API 限制
        }
      }

      console.log(`Daily summaries sent to ${users.length} users`);
    } catch (error) {
      console.error('Error sending daily summaries:', error);
    }
  }

  // 獲取用戶的追蹤列表
  async getUserTrackings(userId) {
    try {
      const subscriptions = await this.database.getUserSubscriptions(userId);
      
      const trackings = [];
      
      for (const subscription of subscriptions) {
        const latestPrices = await this.database.getLatestPrices(subscription.route_id, 3);
        const priceTrend = await this.database.getPriceTrend(subscription.route_id, 7);
        
        trackings.push({
          id: subscription.id,
          route: `${subscription.origin} → ${subscription.destination}`,
          departureDate: subscription.departure_date,
          returnDate: subscription.return_date,
          passengers: subscription.passengers,
          maxPrice: subscription.max_price,
          latestPrices,
          priceTrend: priceTrend.slice(0, 7) // 最近7天
        });
      }
      
      return trackings;
    } catch (error) {
      console.error('Error getting user trackings:', error);
      throw error;
    }
  }

  // 獲取價格分析
  async getPriceAnalysis(routeId) {
    try {
      const [latestPrices, priceTrend] = await Promise.all([
        this.database.getLatestPrices(routeId, 20),
        this.database.getPriceTrend(routeId, 30)
      ]);

      if (latestPrices.length === 0) {
        return {
          message: '暫無價格數據',
          latestPrices: [],
          priceTrend: []
        };
      }

      const prices = latestPrices.map(p => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const currentPrice = prices[0];

      // 價格建議
      let recommendation = '';
      if (currentPrice <= minPrice * 1.1) {
        recommendation = '🟢 目前價格接近最低點，建議購買';
      } else if (currentPrice >= maxPrice * 0.9) {
        recommendation = '🔴 目前價格接近最高點，建議等待';
      } else {
        recommendation = '🟡 價格處於中等水平，可考慮購買';
      }

      return {
        currentPrice,
        minPrice,
        maxPrice,
        avgPrice: Math.round(avgPrice),
        recommendation,
        latestPrices: latestPrices.slice(0, 10),
        priceTrend: priceTrend.slice(0, 14) // 最近14天趨勢
      };
    } catch (error) {
      console.error('Error getting price analysis:', error);
      throw error;
    }
  }

  // 搜尋機票 (不儲存追蹤)
  async searchFlights(searchParams) {
    try {
      this.scraper.validateSearchParams(searchParams);
      const flights = await this.scraper.searchFlights(searchParams);
      
      // 按價格排序
      return flights.sort((a, b) => a.price - b.price);
    } catch (error) {
      console.error('Error searching flights:', error);
      throw error;
    }
  }

  // 獲取機場建議
  async getAirportSuggestions(query) {
    return await this.scraper.getAirportSuggestions(query);
  }

  // 移除追蹤
  async removeTracking(userId, subscriptionId) {
    try {
      await this.database.run(`
        UPDATE user_subscriptions 
        SET notification_enabled = 0 
        WHERE id = ? AND user_id = ?
      `, [subscriptionId, userId]);

      console.log(`Tracking removed for user ${userId}, subscription ${subscriptionId}`);
      return { success: true, message: '追蹤已移除' };
    } catch (error) {
      console.error('Error removing tracking:', error);
      throw error;
    }
  }

  // 延遲函數
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 清理過期的追蹤
  async cleanupExpiredTrackings() {
    try {
      await this.database.run(`
        UPDATE user_subscriptions 
        SET notification_enabled = 0 
        WHERE route_id IN (
          SELECT id FROM flight_routes 
          WHERE date(departure_date) < date('now')
        )
      `);

      console.log('Expired trackings cleaned up');
    } catch (error) {
      console.error('Error cleaning up expired trackings:', error);
    }
  }

  // 獲取統計數據
  async getStats() {
    try {
      const [routeCount, subscriptionCount, priceRecordCount] = await Promise.all([
        this.database.get('SELECT COUNT(*) as count FROM flight_routes'),
        this.database.get('SELECT COUNT(*) as count FROM user_subscriptions WHERE notification_enabled = 1'),
        this.database.get('SELECT COUNT(*) as count FROM price_history')
      ]);

      return {
        totalRoutes: routeCount.count,
        activeSubscriptions: subscriptionCount.count,
        totalPriceRecords: priceRecordCount.count
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }
}

export default FlightTracker;