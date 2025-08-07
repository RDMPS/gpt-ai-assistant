import FlightScraper from './flight-scraper.js';
import FlightDatabase from '../storage/flight-database.js';

class AdvancedFlightStrategies {
  constructor() {
    this.scraper = new FlightScraper();
    this.database = new FlightDatabase();
    
    // 常見的轉機樞紐城市
    this.hubCities = {
      'Asia': ['HKG', 'SIN', 'ICN', 'NRT', 'PVG', 'BKK', 'KUL'],
      'Europe': ['LHR', 'CDG', 'FRA', 'AMS', 'IST', 'ZUR'],
      'Americas': ['LAX', 'JFK', 'ORD', 'DFW', 'YVR', 'MEX'],
      'Middle East': ['DOH', 'DXB', 'AUH', 'CAI']
    };

    // 低成本航空公司列表
    this.budgetAirlines = [
      'AirAsia', 'Jetstar', 'Peach', 'Vanilla Air', 'Spring Airlines',
      'Cebu Pacific', 'Scoot', 'Thai Lion Air', 'IndiGo'
    ];
  }

  // 1. 多城市路線優化搜尋
  async searchMultiCityDeals(origin, destination, departureDate, returnDate = null) {
    try {
      console.log(`Searching multi-city deals: ${origin} → ${destination}`);
      
      const results = [];
      
      // 直飛路線
      const directFlights = await this.scraper.searchFlights({
        origin, destination, departureDate, returnDate
      });
      
      if (directFlights.length > 0) {
        results.push({
          strategy: 'direct',
          routes: [`${origin} → ${destination}`],
          flights: directFlights,
          totalPrice: Math.min(...directFlights.map(f => f.price)),
          savings: 0
        });
      }

      // 尋找可能的中轉城市
      const hubCitiesForRegion = this.getRelevantHubs(origin, destination);
      
      for (const hub of hubCitiesForRegion) {
        if (hub === origin || hub === destination) continue;
        
        try {
          // 搜尋分段路線：origin → hub → destination
          const [segment1, segment2] = await Promise.all([
            this.scraper.searchFlights({
              origin, 
              destination: hub, 
              departureDate
            }),
            this.scraper.searchFlights({
              origin: hub, 
              destination, 
              departureDate: this.addDays(departureDate, 1) // 隔天轉機
            })
          ]);

          if (segment1.length > 0 && segment2.length > 0) {
            const cheapestSeg1 = segment1.reduce((min, f) => f.price < min.price ? f : min);
            const cheapestSeg2 = segment2.reduce((min, f) => f.price < min.price ? f : min);
            const totalPrice = cheapestSeg1.price + cheapestSeg2.price;
            
            // 如果分段比直飛便宜
            const directPrice = results[0]?.totalPrice || Infinity;
            if (totalPrice < directPrice * 0.9) { // 至少便宜10%
              results.push({
                strategy: 'multi_city',
                routes: [`${origin} → ${hub}`, `${hub} → ${destination}`],
                flights: [cheapestSeg1, cheapestSeg2],
                totalPrice: totalPrice,
                savings: directPrice - totalPrice,
                hub: hub,
                layoverTime: '24+ hours'
              });
            }
          }
        } catch (error) {
          console.error(`Error searching via ${hub}:`, error);
        }
      }

      // 按省錢金額排序
      return results.sort((a, b) => (b.savings || 0) - (a.savings || 0));
    } catch (error) {
      console.error('Error in multi-city search:', error);
      throw error;
    }
  }

  // 2. 彈性日期搜尋
  async searchFlexibleDates(origin, destination, targetDate, flexDays = 3) {
    try {
      console.log(`Searching flexible dates around ${targetDate} (±${flexDays} days)`);
      
      const results = [];
      const baseDate = new Date(targetDate);
      
      // 搜尋前後幾天的價格
      for (let i = -flexDays; i <= flexDays; i++) {
        const searchDate = new Date(baseDate);
        searchDate.setDate(baseDate.getDate() + i);
        const dateString = searchDate.toISOString().split('T')[0];
        
        try {
          const flights = await this.scraper.searchFlights({
            origin, destination, departureDate: dateString
          });
          
          if (flights.length > 0) {
            const cheapestFlight = flights.reduce((min, f) => f.price < min.price ? f : min);
            results.push({
              date: dateString,
              dayOffset: i,
              price: cheapestFlight.price,
              flight: cheapestFlight,
              isWeekend: this.isWeekend(searchDate),
              dayOfWeek: searchDate.getDay()
            });
          }
        } catch (error) {
          console.error(`Error searching date ${dateString}:`, error);
        }
      }

      // 分析價格模式
      const analysis = this.analyzePricePatterns(results);
      
      return {
        results: results.sort((a, b) => a.price - b.price),
        analysis,
        recommendations: this.generateDateRecommendations(results)
      };
    } catch (error) {
      console.error('Error in flexible date search:', error);
      throw error;
    }
  }

  // 3. 隱藏城市票價搜尋
  async searchHiddenCityDeals(origin, realDestination) {
    try {
      console.log(`Searching hidden city deals to ${realDestination}`);
      
      const results = [];
      const possibleDestinations = this.getDestinationsBeyond(realDestination);
      
      for (const finalDest of possibleDestinations) {
        try {
          const flights = await this.scraper.searchFlights({
            origin,
            destination: finalDest,
            departureDate: new Date().toISOString().split('T')[0]
          });

          // 檢查是否有經過真實目的地的航班
          const hiddenCityFlights = flights.filter(flight => {
            return this.flightStopsAt(flight, realDestination);
          });

          if (hiddenCityFlights.length > 0) {
            hiddenCityFlights.forEach(flight => {
              results.push({
                strategy: 'hidden_city',
                ticketRoute: `${origin} → ${finalDest}`,
                actualRoute: `${origin} → ${realDestination}`,
                flight: flight,
                warning: '此策略有風險：1) 違反航空公司條款 2) 不能托運行李到最終目的地 3) 回程票可能被取消',
                riskLevel: 'HIGH'
              });
            });
          }
        } catch (error) {
          console.error(`Error searching hidden city via ${finalDest}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('Error in hidden city search:', error);
      throw error;
    }
  }

  // 4. 錯誤票價監控
  async monitorErrorFares(routes) {
    try {
      console.log('Monitoring for error fares...');
      
      const errorFares = [];
      
      for (const route of routes) {
        const { origin, destination } = route;
        
        // 獲取歷史價格平均
        const routeId = await this.database.getOrCreateRoute(origin, destination, '2024-01-01');
        const historicalPrices = await this.database.getLatestPrices(routeId, 30);
        
        if (historicalPrices.length < 5) continue;
        
        const avgPrice = historicalPrices.reduce((sum, p) => sum + p.price, 0) / historicalPrices.length;
        const minPrice = Math.min(...historicalPrices.map(p => p.price));
        
        // 搜尋當前價格
        const currentFlights = await this.scraper.searchFlights({
          origin, destination, departureDate: new Date().toISOString().split('T')[0]
        });
        
        currentFlights.forEach(flight => {
          // 如果價格異常低（低於歷史最低的50%）
          if (flight.price < minPrice * 0.5) {
            errorFares.push({
              route: `${origin} → ${destination}`,
              flight: flight,
              normalPrice: avgPrice,
              discount: ((avgPrice - flight.price) / avgPrice * 100).toFixed(1),
              confidence: this.calculateErrorFareConfidence(flight.price, avgPrice, minPrice),
              detectedAt: new Date().toISOString()
            });
          }
        });
      }

      return errorFares;
    } catch (error) {
      console.error('Error monitoring error fares:', error);
      throw error;
    }
  }

  // 5. 低成本航空特殊優惠搜尋
  async searchBudgetAirlineDeals(origin, destination, departureDate) {
    try {
      console.log('Searching budget airline specific deals...');
      
      const budgetDeals = [];
      const allFlights = await this.scraper.searchFlights({ origin, destination, departureDate });
      
      // 篩選低成本航空
      const budgetFlights = allFlights.filter(flight => 
        this.budgetAirlines.some(airline => 
          flight.airline.toLowerCase().includes(airline.toLowerCase())
        )
      );

      // 分析低成本航空的特殊模式
      budgetFlights.forEach(flight => {
        let dealType = 'standard';
        let savings = 0;
        
        // 檢查是否是紅眼航班（通常較便宜）
        if (this.isRedEyeFlight(flight.departureTime, flight.arrivalTime)) {
          dealType = 'red_eye';
          savings = 1000; // 估計省錢金額
        }
        
        // 檢查是否是促銷期間
        if (this.isPromotionalPeriod()) {
          dealType = 'promotional';
          savings = 2000;
        }

        budgetDeals.push({
          ...flight,
          dealType,
          estimatedSavings: savings,
          tips: this.getBudgetAirlineTips(flight.airline)
        });
      });

      return budgetDeals;
    } catch (error) {
      console.error('Error searching budget airline deals:', error);
      throw error;
    }
  }

  // 6. 季節性和事件驅動的價格預測
  async predictSeasonalPricing(origin, destination, targetMonth) {
    try {
      console.log(`Predicting seasonal pricing for ${origin} → ${destination} in month ${targetMonth}`);
      
      // 獲取歷史數據
      const routeId = await this.database.getOrCreateRoute(origin, destination, '2024-01-01');
      const historicalData = await this.database.all(`
        SELECT 
          strftime('%m', scraped_at) as month,
          AVG(price) as avg_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          COUNT(*) as sample_count
        FROM price_history 
        WHERE route_id = ? 
        GROUP BY strftime('%m', scraped_at)
        ORDER BY month
      `, [routeId]);

      // 分析季節性模式
      const seasonalAnalysis = {
        targetMonth: targetMonth,
        historicalData,
        recommendations: [],
        events: this.getSeasonalEvents(origin, destination, targetMonth)
      };

      // 生成建議
      if (historicalData.length > 0) {
        const targetMonthData = historicalData.find(d => d.month === targetMonth.toString().padStart(2, '0'));
        const avgAllMonths = historicalData.reduce((sum, d) => sum + d.avg_price, 0) / historicalData.length;
        
        if (targetMonthData) {
          const priceVariation = ((targetMonthData.avg_price - avgAllMonths) / avgAllMonths * 100);
          
          if (priceVariation > 20) {
            seasonalAnalysis.recommendations.push(`${targetMonth}月是旺季，價格通常高出平均${priceVariation.toFixed(1)}%`);
          } else if (priceVariation < -20) {
            seasonalAnalysis.recommendations.push(`${targetMonth}月是淡季，價格通常低於平均${Math.abs(priceVariation).toFixed(1)}%`);
          }
        }
      }

      return seasonalAnalysis;
    } catch (error) {
      console.error('Error predicting seasonal pricing:', error);
      throw error;
    }
  }

  // 輔助方法
  getRelevantHubs(origin, destination) {
    // 根據地理位置返回相關的轉機城市
    const asianCities = ['TPE', 'TSA', 'KHH', 'NRT', 'HND', 'ICN', 'HKG', 'SIN', 'BKK'];
    
    if (asianCities.includes(origin) || asianCities.includes(destination)) {
      return this.hubCities.Asia;
    }
    
    return [...this.hubCities.Asia, ...this.hubCities.Europe].slice(0, 5);
  }

  addDays(dateString, days) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  analyzePricePatterns(results) {
    const weekdayPrices = results.filter(r => !r.isWeekend).map(r => r.price);
    const weekendPrices = results.filter(r => r.isWeekend).map(r => r.price);
    
    const avgWeekday = weekdayPrices.length > 0 ? 
      weekdayPrices.reduce((a, b) => a + b, 0) / weekdayPrices.length : 0;
    const avgWeekend = weekendPrices.length > 0 ? 
      weekendPrices.reduce((a, b) => a + b, 0) / weekendPrices.length : 0;

    return {
      weekdayAverage: avgWeekday,
      weekendAverage: avgWeekend,
      weekendPremium: avgWeekend > avgWeekday ? 
        ((avgWeekend - avgWeekday) / avgWeekday * 100).toFixed(1) + '%' : 'No premium',
      bestDay: results.reduce((min, r) => r.price < min.price ? r : min)
    };
  }

  generateDateRecommendations(results) {
    const recommendations = [];
    const cheapest = results.reduce((min, r) => r.price < min.price ? r : min);
    
    recommendations.push(`最便宜的日期是 ${cheapest.date}，價格 $${cheapest.price}`);
    
    // 週間建議
    const weekdayResults = results.filter(r => !r.isWeekend);
    if (weekdayResults.length > 0) {
      const cheapestWeekday = weekdayResults.reduce((min, r) => r.price < min.price ? r : min);
      recommendations.push(`週間最便宜：${cheapestWeekday.date} ($${cheapestWeekday.price})`);
    }

    return recommendations;
  }

  flightStopsAt(flight, city) {
    // 模擬檢查航班是否經過特定城市
    // 實際實作需要解析航班路線資訊
    return Math.random() > 0.8; // 20% 機率經過
  }

  getDestinationsBeyond(city) {
    const beyondDestinations = {
      'NRT': ['LAX', 'SFO', 'SEA', 'YVR'],
      'ICN': ['LAX', 'JFK', 'ORD'],
      'HKG': ['LAX', 'SFO', 'YVR', 'LHR'],
      'SIN': ['LHR', 'CDG', 'FRA', 'SYD']
    };
    
    return beyondDestinations[city] || [];
  }

  calculateErrorFareConfidence(currentPrice, avgPrice, minPrice) {
    const deviation = (avgPrice - currentPrice) / avgPrice;
    if (deviation > 0.7) return 'HIGH';
    if (deviation > 0.5) return 'MEDIUM';
    return 'LOW';
  }

  isRedEyeFlight(departureTime, arrivalTime) {
    const depHour = parseInt(departureTime.split(':')[0]);
    return depHour >= 23 || depHour <= 5; // 11 PM - 5 AM
  }

  isPromotionalPeriod() {
    const now = new Date();
    const month = now.getMonth() + 1;
    // 通常1月、11月是促銷月
    return month === 1 || month === 11;
  }

  getBudgetAirlineTips(airline) {
    const tips = {
      'AirAsia': [
        '手提行李限制較嚴格，注意重量',
        '提早選位避免額外費用',
        '餐點需另外購買'
      ],
      'Jetstar': [
        '基本票價不含行李',
        'Bundle套餐可能更划算',
        '變更費用較高'
      ]
    };
    
    return tips[airline] || ['注意額外費用', '閱讀條款細則'];
  }

  getSeasonalEvents(origin, destination, month) {
    const events = {
      1: ['新年假期', '冬季旅遊旺季'],
      2: ['春節假期', '情人節'],
      3: ['春假', '賞櫻季開始'],
      4: ['賞櫻旺季', '復活節'],
      7: ['暑假開始'],
      8: ['暑假旺季'],
      10: ['楓葉季', '國慶假期'],
      12: ['聖誕新年假期']
    };
    
    return events[month] || [];
  }
}

export default AdvancedFlightStrategies;