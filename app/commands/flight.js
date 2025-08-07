import FlightTracker from '../../services/flight-tracker.js';
import AdvancedFlightStrategies from '../../services/advanced-flight-strategies.js';

const flightTracker = new FlightTracker();
const advancedStrategies = new AdvancedFlightStrategies();

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

  // 進階搜尋 - 旅遊達人策略
  async expert(userId, params) {
    try {
      const [origin, destination, departureDate] = params;
      
      if (!origin || !destination || !departureDate) {
        return {
          type: 'text',
          text: '❌ 使用方式：/flight expert [出發地] [目的地] [出發日期]\n\n' +
                '這將使用旅遊達人的各種策略幫您找到最便宜的機票！\n\n' +
                '範例：/flight expert TPE NRT 2024-03-15'
        };
      }

      let message = `🎯 旅遊達人策略搜尋\n航線：${origin} → ${destination}\n日期：${departureDate}\n\n`;
      message += `正在使用多種策略搜尋最便宜的選項...\n\n`;

      // 1. 多城市策略
      try {
        const multiCityResults = await advancedStrategies.searchMultiCityDeals(
          origin, destination, departureDate
        );
        
        if (multiCityResults.length > 1) { // 除了直飛還有其他選項
          const bestDeal = multiCityResults.find(r => r.savings > 0);
          if (bestDeal) {
            message += `💰 多城市策略：\n`;
            message += `經由 ${bestDeal.hub} 轉機可省 $${bestDeal.savings}\n`;
            message += `總價：$${bestDeal.totalPrice}\n\n`;
          }
        }
      } catch (error) {
        console.error('Multi-city search error:', error);
      }

      // 2. 彈性日期策略
      try {
        const flexibleResults = await advancedStrategies.searchFlexibleDates(
          origin, destination, departureDate, 3
        );
        
        if (flexibleResults.results.length > 0) {
          const cheapest = flexibleResults.results[0];
          if (cheapest.dayOffset !== 0) {
            message += `📅 彈性日期策略：\n`;
            message += `改為 ${cheapest.date} 出發\n`;
            message += `價格：$${cheapest.price}\n`;
            message += `${cheapest.dayOffset > 0 ? '延後' : '提前'} ${Math.abs(cheapest.dayOffset)} 天\n\n`;
          }
          
          if (flexibleResults.analysis.weekendPremium !== 'No premium') {
            message += `📊 週末加價：${flexibleResults.analysis.weekendPremium}\n\n`;
          }
        }
      } catch (error) {
        console.error('Flexible dates search error:', error);
      }

      // 3. 低成本航空策略
      try {
        const budgetResults = await advancedStrategies.searchBudgetAirlineDeals(
          origin, destination, departureDate
        );
        
        if (budgetResults.length > 0) {
          const cheapestBudget = budgetResults.reduce((min, f) => f.price < min.price ? f : min);
          message += `🏷️ 低成本航空：\n`;
          message += `${cheapestBudget.airline} - $${cheapestBudget.price}\n`;
          
          if (cheapestBudget.dealType === 'red_eye') {
            message += `🌙 紅眼航班額外優惠\n`;
          }
          
          if (cheapestBudget.tips.length > 0) {
            message += `💡 注意：${cheapestBudget.tips[0]}\n`;
          }
          message += `\n`;
        }
      } catch (error) {
        console.error('Budget airline search error:', error);
      }

      // 4. 隱藏城市策略（高風險提醒）
      try {
        const hiddenCityResults = await advancedStrategies.searchHiddenCityDeals(
          origin, destination
        );
        
        if (hiddenCityResults.length > 0) {
          message += `⚠️ 隱藏城市策略：\n`;
          message += `發現 ${hiddenCityResults.length} 個選項\n`;
          message += `⚠️ 高風險策略，可能違反航空公司條款\n\n`;
        }
      } catch (error) {
        console.error('Hidden city search error:', error);
      }

      message += `✅ 搜尋完成！\n\n`;
      message += `💡 提示：\n`;
      message += `• 使用 /flight flexible [起點] [終點] [日期] 查看詳細彈性日期\n`;
      message += `• 使用 /flight multicity [起點] [終點] [日期] 查看轉機選項`;

      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('Expert search error:', error);
      return {
        type: 'text',
        text: `❌ 專家搜尋時發生錯誤：${error.message}`
      };
    }
  },

  // 彈性日期詳細搜尋
  async flexible(userId, params) {
    try {
      const [origin, destination, targetDate, days = '3'] = params;
      
      if (!origin || !destination || !targetDate) {
        return {
          type: 'text',
          text: '❌ 使用方式：/flight flexible [出發地] [目的地] [目標日期] [彈性天數]\n\n' +
                '範例：/flight flexible TPE NRT 2024-03-15 5'
        };
      }

      const flexDays = parseInt(days);
      const results = await advancedStrategies.searchFlexibleDates(
        origin, destination, targetDate, flexDays
      );

      if (results.results.length === 0) {
        return {
          type: 'text',
          text: `❌ 在 ${targetDate} 前後 ${flexDays} 天內未找到航班`
        };
      }

      let message = `📅 彈性日期搜尋結果\n`;
      message += `${origin} → ${destination}\n`;
      message += `目標日期：${targetDate} (±${flexDays}天)\n\n`;

      // 顯示最便宜的幾個選項
      const topResults = results.results.slice(0, 5);
      topResults.forEach((result, index) => {
        const dayDiff = result.dayOffset;
        const dayDesc = dayDiff === 0 ? '目標日期' : 
                      dayDiff > 0 ? `延後${dayDiff}天` : `提前${Math.abs(dayDiff)}天`;
        
        message += `${index + 1}. ${result.date} (${dayDesc})\n`;
        message += `   💰 $${result.price} | ${result.flight.airline}\n`;
        message += `   ${result.isWeekend ? '🔸週末' : '🔹平日'}\n\n`;
      });

      // 添加分析
      message += `📊 價格分析：\n`;
      message += `• 平日平均：$${Math.round(results.analysis.weekdayAverage)}\n`;
      message += `• 週末平均：$${Math.round(results.analysis.weekendAverage)}\n`;
      message += `• 週末加價：${results.analysis.weekendPremium}\n\n`;

      // 添加建議
      if (results.recommendations.length > 0) {
        message += `💡 建議：\n`;
        results.recommendations.forEach(rec => {
          message += `• ${rec}\n`;
        });
      }

      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('Flexible search error:', error);
      return {
        type: 'text',
        text: `❌ 彈性日期搜尋時發生錯誤：${error.message}`
      };
    }
  },

  // 多城市轉機搜尋
  async multicity(userId, params) {
    try {
      const [origin, destination, departureDate] = params;
      
      if (!origin || !destination || !departureDate) {
        return {
          type: 'text',
          text: '❌ 使用方式：/flight multicity [出發地] [目的地] [出發日期]\n\n' +
                '這將搜尋通過其他城市轉機的便宜選項\n\n' +
                '範例：/flight multicity TPE LAX 2024-03-15'
        };
      }

      const results = await advancedStrategies.searchMultiCityDeals(
        origin, destination, departureDate
      );

      if (results.length <= 1) {
        return {
          type: 'text',
          text: `❌ 未找到比直飛更便宜的轉機選項\n\n直飛價格：$${results[0]?.totalPrice || 'N/A'}`
        };
      }

      let message = `🔄 多城市轉機選項\n`;
      message += `${origin} → ${destination}\n`;
      message += `日期：${departureDate}\n\n`;

      // 顯示省錢的轉機選項
      const savingOptions = results.filter(r => r.savings > 0);
      savingOptions.forEach((option, index) => {
        message += `${index + 1}. 經由 ${option.hub} 轉機\n`;
        message += `   💰 總價：$${option.totalPrice}\n`;
        message += `   💵 省下：$${option.savings}\n`;
        message += `   ⏱️ 轉機時間：${option.layoverTime}\n`;
        message += `   📍 路線：${option.routes.join(' → ')}\n\n`;
      });

      if (savingOptions.length === 0) {
        message += `📋 雖然有轉機選項，但都比直飛貴\n`;
        message += `建議選擇直飛：$${results[0].totalPrice}`;
      } else {
        message += `💡 提示：\n`;
        message += `• 轉機需要額外時間，但可省錢\n`;
        message += `• 建議至少提前2小時轉機\n`;
        message += `• 分段票需分別辦理登機`;
      }

      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('Multi-city search error:', error);
      return {
        type: 'text',
        text: `❌ 多城市搜尋時發生錯誤：${error.message}`
      };
    }
  },

  // 季節性價格預測
  async seasonal(userId, params) {
    try {
      const [origin, destination, month] = params;
      
      if (!origin || !destination || !month) {
        return {
          type: 'text',
          text: '❌ 使用方式：/flight seasonal [出發地] [目的地] [月份]\n\n' +
                '查看特定月份的價格趨勢和建議\n\n' +
                '範例：/flight seasonal TPE NRT 4'
        };
      }

      const monthNum = parseInt(month);
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return {
          type: 'text',
          text: '❌ 月份必須是 1-12 之間的數字'
        };
      }

      const analysis = await advancedStrategies.predictSeasonalPricing(
        origin, destination, monthNum
      );

      let message = `📊 季節性價格分析\n`;
      message += `${origin} → ${destination} | ${monthNum}月\n\n`;

      if (analysis.recommendations.length > 0) {
        message += `📈 分析結果：\n`;
        analysis.recommendations.forEach(rec => {
          message += `• ${rec}\n`;
        });
        message += `\n`;
      }

      if (analysis.events.length > 0) {
        message += `🎉 ${monthNum}月特殊事件：\n`;
        analysis.events.forEach(event => {
          message += `• ${event}\n`;
        });
        message += `\n`;
      }

      if (analysis.historicalData.length > 0) {
        message += `📋 歷史數據：\n`;
        const monthData = analysis.historicalData.find(d => d.month === monthNum.toString().padStart(2, '0'));
        if (monthData) {
          message += `• 平均價格：$${Math.round(monthData.avg_price)}\n`;
          message += `• 最低價格：$${Math.round(monthData.min_price)}\n`;
          message += `• 最高價格：$${Math.round(monthData.max_price)}\n`;
        }
      } else {
        message += `📋 暫無足夠的歷史數據進行分析\n`;
        message += `建議使用其他搜尋功能獲取即時價格`;
      }

      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('Seasonal analysis error:', error);
      return {
        type: 'text',
        text: `❌ 季節性分析時發生錯誤：${error.message}`
      };
    }
  },

  // 幫助信息
  help() {
    return {
      type: 'text',
      text: `✈️ 機票價格追蹤助手\n\n` +
            `📋 基本命令：\n` +
            `🔍 /flight search [出發地] [目的地] [日期]\n` +
            `   搜尋機票價格\n` +
            `📍 /flight track [出發地] [目的地] [日期] [價格上限]\n` +
            `   追蹤機票價格變化\n` +
            `📋 /flight list\n` +
            `   查看追蹤列表\n` +
            `❌ /flight remove [編號]\n` +
            `   移除追蹤\n` +
            `📊 /flight analysis [路線ID]\n` +
            `   查看價格分析\n` +
            `🛫 /flight airports [查詢]\n` +
            `   查詢機場代碼\n\n` +
            `🎯 旅遊達人策略：\n` +
            `💡 /flight expert [出發地] [目的地] [日期]\n` +
            `   使用多種策略找最便宜機票\n` +
            `📅 /flight flexible [出發地] [目的地] [日期] [天數]\n` +
            `   彈性日期搜尋\n` +
            `🔄 /flight multicity [出發地] [目的地] [日期]\n` +
            `   多城市轉機搜尋\n` +
            `📊 /flight seasonal [出發地] [目的地] [月份]\n` +
            `   季節性價格分析\n\n` +
            `💡 範例：\n` +
            `• /flight expert TPE NRT 2024-03-15\n` +
            `• /flight flexible TPE NRT 2024-03-15 5\n` +
            `• /flight seasonal TPE NRT 4`
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
    // 新增的旅遊達人策略命令
    case 'expert':
      return flightCommands.expert(userId, params);
    case 'flexible':
      return flightCommands.flexible(userId, params);
    case 'multicity':
      return flightCommands.multicity(userId, params);
    case 'seasonal':
      return flightCommands.seasonal(userId, params);
    case 'help':
    default:
      return flightCommands.help();
  }
}