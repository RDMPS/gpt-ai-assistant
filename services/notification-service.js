import axios from 'axios';
import config from '../config/index.js';

class NotificationService {
  constructor() {
    this.lineChannelAccessToken = config.LINE_CHANNEL_ACCESS_TOKEN;
    this.lineApiUrl = 'https://api.line.me/v2/bot/message/push';
  }

  // 發送 LINE 訊息
  async sendLineMessage(userId, message) {
    try {
      if (!this.lineChannelAccessToken) {
        console.log('LINE Channel Access Token not configured');
        return false;
      }

      const response = await axios.post(this.lineApiUrl, {
        to: userId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${this.lineChannelAccessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`LINE message sent to ${userId}`);
      return true;
    } catch (error) {
      console.error('Error sending LINE message:', error.response?.data || error.message);
      return false;
    }
  }

  // 發送機票價格警報
  async sendFlightPriceAlert(alert) {
    try {
      let message = '';
      
      if (alert.alertType === 'price_target_reached') {
        message = `🎯 機票價格警報！\n\n` +
                 `航線: ${alert.route}\n` +
                 `出發日期: ${alert.departureDate}\n` +
                 `當前價格: $${alert.currentPrice} TWD\n` +
                 `目標價格: $${alert.maxPrice} TWD\n` +
                 `航空公司: ${alert.airline}\n\n` +
                 `✅ 價格已達到您設定的目標，建議立即預訂！\n\n` +
                 `💡 使用 /flight search 搜尋更多選項\n` +
                 `📋 使用 /flight list 查看所有追蹤`;
      } else if (alert.alertType === 'price_drop') {
        message = `📉 機票降價通知！\n\n` +
                 `航線: ${alert.route}\n` +
                 `出發日期: ${alert.departureDate}\n` +
                 `當前價格: $${alert.currentPrice} TWD\n` +
                 `之前價格: $${alert.previousPrice} TWD\n` +
                 `降幅: ${alert.priceChange}%\n` +
                 `航空公司: ${alert.airline}\n\n` +
                 `🎉 價格大幅下降，現在是購買的好時機！\n\n` +
                 `💡 使用 /flight search 搜尋更多選項\n` +
                 `📋 使用 /flight list 查看所有追蹤`;
      }

      const success = await this.sendLineMessage(alert.userId, message);
      
      if (success) {
        console.log(`Flight price alert sent to user ${alert.userId}`);
      }
      
      return success;
    } catch (error) {
      console.error('Error sending flight price alert:', error);
      return false;
    }
  }

  // 發送每日價格摘要
  async sendDailySummary(userId, trackings) {
    try {
      if (!trackings || trackings.length === 0) {
        return false;
      }

      let message = `📊 每日機票價格摘要\n\n`;
      message += `您追蹤的 ${trackings.length} 個航線價格更新：\n\n`;

      trackings.forEach((tracking, index) => {
        const latestPrice = tracking.latestPrices[0];
        if (latestPrice) {
          message += `${index + 1}. ${tracking.route}\n`;
          message += `📅 ${tracking.departureDate}\n`;
          message += `💰 $${latestPrice.price} (${latestPrice.airline})\n`;
          
          // 價格趨勢指示
          if (tracking.latestPrices.length >= 2) {
            const prevPrice = tracking.latestPrices[1].price;
            const change = latestPrice.price - prevPrice;
            if (change > 0) {
              message += `📈 較昨日上漲 $${change}\n`;
            } else if (change < 0) {
              message += `📉 較昨日下降 $${Math.abs(change)}\n`;
            } else {
              message += `➡️ 價格無變化\n`;
            }
          }
          message += `\n`;
        }
      });

      message += `💡 提示：\n`;
      message += `• 使用 /flight list 查看詳細追蹤\n`;
      message += `• 使用 /flight search 搜尋新航班`;

      const success = await this.sendLineMessage(userId, message);
      
      if (success) {
        console.log(`Daily summary sent to user ${userId}`);
      }
      
      return success;
    } catch (error) {
      console.error('Error sending daily summary:', error);
      return false;
    }
  }

  // 發送系統通知
  async sendSystemNotification(userId, title, content) {
    try {
      const message = `🔔 ${title}\n\n${content}`;
      return await this.sendLineMessage(userId, message);
    } catch (error) {
      console.error('Error sending system notification:', error);
      return false;
    }
  }

  // 批量發送通知
  async sendBulkNotifications(notifications) {
    const results = [];
    
    for (const notification of notifications) {
      try {
        const success = await this.sendLineMessage(
          notification.userId,
          notification.message
        );
        results.push({ userId: notification.userId, success });
        
        // 避免 LINE API 限制，添加延遲
        await this.delay(100);
      } catch (error) {
        console.error(`Error sending notification to ${notification.userId}:`, error);
        results.push({ userId: notification.userId, success: false });
      }
    }
    
    return results;
  }

  // 延遲函數
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 格式化價格變化訊息
  formatPriceChangeMessage(oldPrice, newPrice, currency = 'TWD') {
    const change = newPrice - oldPrice;
    const changePercent = ((change / oldPrice) * 100).toFixed(1);
    
    if (change > 0) {
      return `📈 上漲 $${change} ${currency} (+${changePercent}%)`;
    } else if (change < 0) {
      return `📉 下降 $${Math.abs(change)} ${currency} (${changePercent}%)`;
    } else {
      return `➡️ 價格無變化`;
    }
  }

  // 建立 Flex Message (進階 LINE 訊息格式)
  createFlightFlexMessage(flight) {
    return {
      type: 'flex',
      altText: `機票資訊 - ${flight.airline}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: flight.airline,
              weight: 'bold',
              size: 'lg',
              color: '#1DB446'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '價格',
                  size: 'sm',
                  color: '#666666',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `$${flight.price} ${flight.currency}`,
                  weight: 'bold',
                  size: 'lg',
                  color: '#1DB446',
                  flex: 2
                }
              ]
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                {
                  type: 'text',
                  text: '飛行時間',
                  size: 'sm',
                  color: '#666666',
                  flex: 1
                },
                {
                  type: 'text',
                  text: flight.flightTime,
                  size: 'sm',
                  flex: 2
                }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                {
                  type: 'text',
                  text: '轉機',
                  size: 'sm',
                  color: '#666666',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `${flight.stops} 次`,
                  size: 'sm',
                  flex: 2
                }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                uri: flight.bookingUrl,
                label: '前往預訂'
              }
            }
          ]
        }
      }
    };
  }
}

export default NotificationService;