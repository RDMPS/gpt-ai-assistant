import FlightTracker from '../../services/flight-tracker.js';

const flightTracker = new FlightTracker();

// 機票相關命令處理
const flightCommands = {
  // 搜尋機票
  async search(userId, params) {
    try {
      const [origin, destination, departureDate, returnDate] = params;
      
      if (!origin || !destination || !departureDate) {
        return {
          type: 'text',
          text: '❌ 使用方式：/flight search [出發地] [目的地] [出發日期] [回程日期(可選)]\n\n' +
                '範例：\n' +
                '• /flight search TPE NRT 2024-03-15\n' +
                '• /flight search TPE NRT 2024-03-15 2024-03-20'
        };
      }

      const searchParams = {
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departureDate,
        returnDate: returnDate || null,
        passengers: 1
      };

      const flights = await flightTracker.searchFlights(searchParams);
      
      if (flights.length === 0) {
        return {
          type: 'text',
          text: `😔 未找到 ${origin} → ${destination} 的航班\n請檢查機場代碼和日期是否正確`
        };
      }

      // 取前5個最便宜的航班
      const topFlights = flights.slice(0, 5);
      
      let message = `✈️ ${origin} → ${destination} 機票搜尋結果\n`;
      message += `📅 出發：${departureDate}\n`;
      if (returnDate) message += `🔄 回程：${returnDate}\n`;
      message += `\n找到 ${flights.length} 個航班，顯示最便宜的 ${topFlights.length} 個：\n\n`;

      topFlights.forEach((flight, index) => {
        message += `${index + 1}. ${flight.airline}\n`;
        message += `💰 $${flight.price} ${flight.currency}\n`;
        message += `⏱️ ${flight.flightTime} | 🔄 ${flight.stops} 次轉機\n`;
        message += `🛫 ${flight.departureTime} → 🛬 ${flight.arrivalTime}\n\n`;
      });

      message += '💡 提示：\n';
      message += '• 使用 /flight track 來追蹤價格變化\n';
      message += '• 使用 /flight list 查看您的追蹤列表';

      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('Flight search error:', error);
      return {
        type: 'text',
        text: `❌ 搜尋機票時發生錯誤：${error.message}`
      };
    }
  },

  // 追蹤機票價格
  async track(userId, params) {
    try {
      const [origin, destination, departureDate, maxPrice, returnDate] = params;
      
      if (!origin || !destination || !departureDate) {
        return {
          type: 'text',
          text: '❌ 使用方式：/flight track [出發地] [目的地] [出發日期] [價格上限(可選)] [回程日期(可選)]\n\n' +
                '範例：\n' +
                '• /flight track TPE NRT 2024-03-15\n' +
                '• /flight track TPE NRT 2024-03-15 15000\n' +
                '• /flight track TPE NRT 2024-03-15 15000 2024-03-20'
        };
      }

      const searchParams = {
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departureDate,
        returnDate: returnDate || null,
        passengers: 1
      };

      const priceLimit = maxPrice ? parseFloat(maxPrice) : null;
      const result = await flightTracker.addFlightTracking(userId, searchParams, priceLimit);
      
      let message = `✅ 機票價格追蹤已設定\n\n`;
      message += `📍 航線：${origin} → ${destination}\n`;
      message += `📅 出發：${departureDate}\n`;
      if (returnDate) message += `🔄 回程：${returnDate}\n`;
      if (priceLimit) message += `💰 價格上限：$${priceLimit} TWD\n`;
      message += `\n🔔 當價格有變化時，我會主動通知您！\n`;
      message += `📋 使用 /flight list 查看所有追蹤`;

      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('Flight tracking error:', error);
      return {
        type: 'text',
        text: `❌ 設定追蹤時發生錯誤：${error.message}`
      };
    }
  },

  // 查看追蹤列表
  async list(userId) {
    try {
      const trackings = await flightTracker.getUserTrackings(userId);
      
      if (trackings.length === 0) {
        return {
          type: 'text',
          text: '📋 您目前沒有任何機票追蹤\n\n' +
                '💡 使用 /flight track 來開始追蹤機票價格\n' +
                '範例：/flight track TPE NRT 2024-03-15'
        };
      }

      let message = `📋 您的機票追蹤列表 (${trackings.length} 項)\n\n`;
      
      trackings.forEach((tracking, index) => {
        message += `${index + 1}. ${tracking.route}\n`;
        message += `📅 ${tracking.departureDate}`;
        if (tracking.returnDate) message += ` → ${tracking.returnDate}`;
        message += `\n👥 ${tracking.passengers} 人`;
        if (tracking.maxPrice) message += ` | 💰 上限 $${tracking.maxPrice}`;
        
        if (tracking.latestPrices.length > 0) {
          const latest = tracking.latestPrices[0];
          message += `\n💲 最新價格：$${latest.price} (${latest.airline})`;
          message += `\n🕐 ${new Date(latest.scraped_at).toLocaleString()}`;
        } else {
          message += `\n❓ 暫無價格數據`;
        }
        
        message += `\n\n`;
      });

      message += '💡 提示：\n';
      message += '• 使用 /flight remove [編號] 移除追蹤\n';
      message += '• 使用 /flight analysis [路線ID] 查看價格分析';

      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('Flight list error:', error);
      return {
        type: 'text',
        text: `❌ 獲取追蹤列表時發生錯誤：${error.message}`
      };
    }
  },

  // 移除追蹤
  async remove(userId, params) {
    try {
      const [subscriptionId] = params;
      
      if (!subscriptionId) {
        return {
          type: 'text',
          text: '❌ 使用方式：/flight remove [追蹤編號]\n\n' +
                '請先使用 /flight list 查看您的追蹤列表，\n' +
                '然後使用編號來移除特定追蹤'
        };
      }

      await flightTracker.removeTracking(userId, subscriptionId);
      
      return {
        type: 'text',
        text: `✅ 追蹤已成功移除\n\n📋 使用 /flight list 查看剩餘追蹤`
      };
    } catch (error) {
      console.error('Flight remove error:', error);
      return {
        type: 'text',
        text: `❌ 移除追蹤時發生錯誤：${error.message}`
      };
    }
  },

  // 價格分析
  async analysis(userId, params) {
    try {
      const [routeId] = params;
      
      if (!routeId) {
        return {
          type: 'text',
          text: '❌ 使用方式：/flight analysis [路線ID]\n\n' +
                '請從追蹤列表中獲取路線ID'
        };
      }

      const analysis = await flightTracker.getPriceAnalysis(routeId);
      
      if (analysis.message) {
        return {
          type: 'text',
          text: `📊 價格分析\n\n${analysis.message}`
        };
      }

      let message = `📊 價格分析報告\n\n`;
      message += `${analysis.recommendation}\n\n`;
      message += `💰 價格概覽：\n`;
      message += `• 目前價格：$${analysis.currentPrice}\n`;
      message += `• 最低價格：$${analysis.minPrice}\n`;
      message += `• 平均價格：$${analysis.avgPrice}\n`;
      message += `• 最高價格：$${analysis.maxPrice}\n\n`;
      
      if (analysis.latestPrices.length > 0) {
        message += `📈 最近價格記錄：\n`;
        analysis.latestPrices.slice(0, 3).forEach((price, index) => {
          message += `${index + 1}. $${price.price} (${price.airline})\n`;
        });
      }

      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('Flight analysis error:', error);
      return {
        type: 'text',
        text: `❌ 獲取價格分析時發生錯誤：${error.message}`
      };
    }
  },

  // 機場代碼查詢
  async airports(userId, params) {
    try {
      const [query] = params;
      
      if (!query) {
        return {
          type: 'text',
          text: '❌ 使用方式：/flight airports [機場名稱或城市]\n\n' +
                '範例：\n' +
                '• /flight airports 台北\n' +
                '• /flight airports 東京\n' +
                '• /flight airports NRT'
        };
      }

      const suggestions = await flightTracker.getAirportSuggestions(query);
      
      if (suggestions.length === 0) {
        return {
          type: 'text',
          text: `❌ 未找到包含 "${query}" 的機場`
        };
      }

      let message = `🛫 機場代碼查詢結果：\n\n`;
      
      suggestions.forEach(airport => {
        message += `• ${airport.code} - ${airport.name}\n`;
        message += `  📍 ${airport.city}\n\n`;
      });

      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('Airport search error:', error);
      return {
        type: 'text',
        text: `❌ 查詢機場時發生錯誤：${error.message}`
      };
    }
  },

  // 幫助信息
  help() {
    return {
      type: 'text',
      text: `✈️ 機票價格追蹤助手\n\n` +
            `📋 可用命令：\n\n` +
            `🔍 /flight search [出發地] [目的地] [日期]\n` +
            `   搜尋機票價格\n\n` +
            `📍 /flight track [出發地] [目的地] [日期] [價格上限]\n` +
            `   追蹤機票價格變化\n\n` +
            `📋 /flight list\n` +
            `   查看追蹤列表\n\n` +
            `❌ /flight remove [編號]\n` +
            `   移除追蹤\n\n` +
            `📊 /flight analysis [路線ID]\n` +
            `   查看價格分析\n\n` +
            `🛫 /flight airports [查詢]\n` +
            `   查詢機場代碼\n\n` +
            `💡 範例：\n` +
            `• /flight search TPE NRT 2024-03-15\n` +
            `• /flight track TPE NRT 2024-03-15 15000\n` +
            `• /flight airports 台北`
    };
  }
};

// 主要處理函數
export default function handleFlightCommand(userId, text) {
  const parts = text.trim().split(/\s+/);
  
  // 移除 /flight 前綴
  if (parts[0] === '/flight') {
    parts.shift();
  }
  
  const command = parts[0];
  const params = parts.slice(1);
  
  switch (command) {
    case 'search':
      return flightCommands.search(userId, params);
    case 'track':
      return flightCommands.track(userId, params);
    case 'list':
      return flightCommands.list(userId);
    case 'remove':
      return flightCommands.remove(userId, params);
    case 'analysis':
      return flightCommands.analysis(userId, params);
    case 'airports':
      return flightCommands.airports(userId, params);
    case 'help':
    default:
      return flightCommands.help();
  }
}