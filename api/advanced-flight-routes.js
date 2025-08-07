import express from 'express';
import AdvancedFlightStrategies from '../services/advanced-flight-strategies.js';

const router = express.Router();
const advancedStrategies = new AdvancedFlightStrategies();

// 多城市路線優化搜尋
router.post('/multi-city', async (req, res) => {
  try {
    const { origin, destination, departureDate, returnDate } = req.body;
    
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        error: '起點、終點和出發日期為必填欄位'
      });
    }

    const results = await advancedStrategies.searchMultiCityDeals(
      origin, destination, departureDate, returnDate
    );
    
    res.json({
      success: true,
      data: {
        strategies: results,
        count: results.length,
        bestSaving: results.length > 0 ? Math.max(...results.map(r => r.savings || 0)) : 0
      }
    });
  } catch (error) {
    console.error('Multi-city search error:', error);
    res.status(500).json({
      success: false,
      error: '多城市搜尋時發生錯誤'
    });
  }
});

// 彈性日期搜尋
router.post('/flexible-dates', async (req, res) => {
  try {
    const { origin, destination, targetDate, flexDays = 3 } = req.body;
    
    if (!origin || !destination || !targetDate) {
      return res.status(400).json({
        success: false,
        error: '起點、終點和目標日期為必填欄位'
      });
    }

    const results = await advancedStrategies.searchFlexibleDates(
      origin, destination, targetDate, flexDays
    );
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Flexible dates search error:', error);
    res.status(500).json({
      success: false,
      error: '彈性日期搜尋時發生錯誤'
    });
  }
});

// 隱藏城市票價搜尋
router.post('/hidden-city', async (req, res) => {
  try {
    const { origin, realDestination } = req.body;
    
    if (!origin || !realDestination) {
      return res.status(400).json({
        success: false,
        error: '起點和真實目的地為必填欄位'
      });
    }

    const results = await advancedStrategies.searchHiddenCityDeals(origin, realDestination);
    
    res.json({
      success: true,
      data: {
        deals: results,
        count: results.length,
        disclaimer: '隱藏城市票價策略有風險，請仔細閱讀各項警告'
      }
    });
  } catch (error) {
    console.error('Hidden city search error:', error);
    res.status(500).json({
      success: false,
      error: '隱藏城市搜尋時發生錯誤'
    });
  }
});

// 錯誤票價監控
router.post('/error-fares', async (req, res) => {
  try {
    const { routes } = req.body;
    
    if (!routes || !Array.isArray(routes)) {
      return res.status(400).json({
        success: false,
        error: '路線列表為必填欄位'
      });
    }

    const errorFares = await advancedStrategies.monitorErrorFares(routes);
    
    res.json({
      success: true,
      data: {
        errorFares,
        count: errorFares.length,
        lastChecked: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fares monitoring error:', error);
    res.status(500).json({
      success: false,
      error: '錯誤票價監控時發生錯誤'
    });
  }
});

// 低成本航空特殊優惠搜尋
router.post('/budget-deals', async (req, res) => {
  try {
    const { origin, destination, departureDate } = req.body;
    
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        error: '起點、終點和出發日期為必填欄位'
      });
    }

    const budgetDeals = await advancedStrategies.searchBudgetAirlineDeals(
      origin, destination, departureDate
    );
    
    res.json({
      success: true,
      data: {
        deals: budgetDeals,
        count: budgetDeals.length,
        airlines: [...new Set(budgetDeals.map(d => d.airline))]
      }
    });
  } catch (error) {
    console.error('Budget deals search error:', error);
    res.status(500).json({
      success: false,
      error: '低成本航空搜尋時發生錯誤'
    });
  }
});

// 季節性價格預測
router.get('/seasonal-pricing/:origin/:destination/:month', async (req, res) => {
  try {
    const { origin, destination, month } = req.params;
    
    const monthNum = parseInt(month);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        error: '月份必須是1-12之間的數字'
      });
    }

    const analysis = await advancedStrategies.predictSeasonalPricing(
      origin, destination, monthNum
    );
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Seasonal pricing prediction error:', error);
    res.status(500).json({
      success: false,
      error: '季節性價格預測時發生錯誤'
    });
  }
});

// 旅遊達人策略總覽
router.post('/expert-search', async (req, res) => {
  try {
    const { origin, destination, departureDate, strategies = ['all'] } = req.body;
    
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        error: '起點、終點和出發日期為必填欄位'
      });
    }

    const results = {};
    
    // 根據用戶選擇的策略執行搜尋
    if (strategies.includes('all') || strategies.includes('multi-city')) {
      results.multiCity = await advancedStrategies.searchMultiCityDeals(
        origin, destination, departureDate
      );
    }
    
    if (strategies.includes('all') || strategies.includes('flexible-dates')) {
      results.flexibleDates = await advancedStrategies.searchFlexibleDates(
        origin, destination, departureDate, 3
      );
    }
    
    if (strategies.includes('all') || strategies.includes('budget-airlines')) {
      results.budgetDeals = await advancedStrategies.searchBudgetAirlineDeals(
        origin, destination, departureDate
      );
    }
    
    if (strategies.includes('all') || strategies.includes('hidden-city')) {
      results.hiddenCity = await advancedStrategies.searchHiddenCityDeals(
        origin, destination
      );
    }

    // 生成綜合建議
    const recommendations = generateExpertRecommendations(results);
    
    res.json({
      success: true,
      data: {
        results,
        recommendations,
        searchedStrategies: strategies,
        totalOptionsFound: Object.values(results).flat().length
      }
    });
  } catch (error) {
    console.error('Expert search error:', error);
    res.status(500).json({
      success: false,
      error: '專家搜尋時發生錯誤'
    });
  }
});

// 比較不同策略的節省金額
router.post('/savings-comparison', async (req, res) => {
  try {
    const { origin, destination, departureDate, baselinePrice } = req.body;
    
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        error: '起點、終點和出發日期為必填欄位'
      });
    }

    const comparison = [];
    
    // 多城市策略
    const multiCityResults = await advancedStrategies.searchMultiCityDeals(
      origin, destination, departureDate
    );
    
    multiCityResults.forEach(result => {
      comparison.push({
        strategy: 'Multi-City',
        description: `經由 ${result.hub || 'unknown'} 轉機`,
        price: result.totalPrice,
        savings: result.savings || 0,
        risk: 'LOW',
        complexity: 'MEDIUM'
      });
    });

    // 彈性日期策略
    const flexibleResults = await advancedStrategies.searchFlexibleDates(
      origin, destination, departureDate, 5
    );
    
    if (flexibleResults.results.length > 0) {
      const cheapest = flexibleResults.results[0];
      comparison.push({
        strategy: 'Flexible Dates',
        description: `改為 ${cheapest.date} 出發`,
        price: cheapest.price,
        savings: baselinePrice ? baselinePrice - cheapest.price : 0,
        risk: 'LOW',
        complexity: 'LOW'
      });
    }

    // 低成本航空策略
    const budgetResults = await advancedStrategies.searchBudgetAirlineDeals(
      origin, destination, departureDate
    );
    
    if (budgetResults.length > 0) {
      const cheapestBudget = budgetResults.reduce((min, flight) => 
        flight.price < min.price ? flight : min
      );
      
      comparison.push({
        strategy: 'Budget Airlines',
        description: `選擇 ${cheapestBudget.airline}`,
        price: cheapestBudget.price,
        savings: baselinePrice ? baselinePrice - cheapestBudget.price : cheapestBudget.estimatedSavings,
        risk: 'LOW',
        complexity: 'LOW',
        tips: cheapestBudget.tips
      });
    }

    // 按節省金額排序
    comparison.sort((a, b) => b.savings - a.savings);
    
    res.json({
      success: true,
      data: {
        comparison,
        bestStrategy: comparison[0] || null,
        totalStrategies: comparison.length
      }
    });
  } catch (error) {
    console.error('Savings comparison error:', error);
    res.status(500).json({
      success: false,
      error: '節省金額比較時發生錯誤'
    });
  }
});

// 生成專家建議的輔助函數
function generateExpertRecommendations(results) {
  const recommendations = [];
  
  // 分析多城市結果
  if (results.multiCity && results.multiCity.length > 0) {
    const bestMultiCity = results.multiCity[0];
    if (bestMultiCity.savings > 2000) {
      recommendations.push({
        type: 'high_savings',
        strategy: 'multi_city',
        message: `💰 通過 ${bestMultiCity.hub} 轉機可節省 $${bestMultiCity.savings}，但需要額外的旅行時間`,
        savings: bestMultiCity.savings
      });
    }
  }
  
  // 分析彈性日期結果
  if (results.flexibleDates && results.flexibleDates.analysis) {
    const analysis = results.flexibleDates.analysis;
    if (analysis.weekendPremium !== 'No premium') {
      recommendations.push({
        type: 'date_optimization',
        strategy: 'flexible_dates',
        message: `📅 避開週末可節省 ${analysis.weekendPremium} 的費用`,
        bestDate: analysis.bestDay?.date
      });
    }
  }
  
  // 分析低成本航空結果
  if (results.budgetDeals && results.budgetDeals.length > 0) {
    const redEyeFlights = results.budgetDeals.filter(d => d.dealType === 'red_eye');
    if (redEyeFlights.length > 0) {
      recommendations.push({
        type: 'time_flexibility',
        strategy: 'budget_airlines',
        message: `🌙 選擇紅眼航班可額外節省約 $1000`,
        count: redEyeFlights.length
      });
    }
  }
  
  // 分析隱藏城市結果
  if (results.hiddenCity && results.hiddenCity.length > 0) {
    recommendations.push({
      type: 'high_risk_high_reward',
      strategy: 'hidden_city',
      message: `⚠️ 發現 ${results.hiddenCity.length} 個隱藏城市選項，但風險較高`,
      warning: '違反航空公司條款，謹慎使用'
    });
  }
  
  return recommendations.sort((a, b) => (b.savings || 0) - (a.savings || 0));
}

export default router;