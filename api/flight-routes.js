import express from 'express';
import FlightTracker from '../services/flight-tracker.js';

const router = express.Router();
const flightTracker = new FlightTracker();

// 啟動追蹤系統
flightTracker.start().catch(console.error);

// 搜尋機票
router.post('/search', async (req, res) => {
  try {
    const { origin, destination, departureDate, returnDate, passengers } = req.body;
    
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        error: '起點、終點和出發日期為必填欄位'
      });
    }

    const searchParams = {
      origin,
      destination,
      departureDate,
      returnDate,
      passengers: passengers || 1
    };

    const flights = await flightTracker.searchFlights(searchParams);
    
    res.json({
      success: true,
      data: {
        flights,
        searchParams,
        count: flights.length
      }
    });
  } catch (error) {
    console.error('Flight search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '搜尋機票時發生錯誤'
    });
  }
});

// 添加機票價格追蹤
router.post('/track', async (req, res) => {
  try {
    const { userId, origin, destination, departureDate, returnDate, passengers, maxPrice } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '用戶ID為必填欄位'
      });
    }

    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        error: '起點、終點和出發日期為必填欄位'
      });
    }

    const searchParams = {
      origin,
      destination,
      departureDate,
      returnDate,
      passengers: passengers || 1
    };

    const result = await flightTracker.addFlightTracking(userId, searchParams, maxPrice);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Add tracking error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '添加追蹤時發生錯誤'
    });
  }
});

// 獲取用戶的追蹤列表
router.get('/trackings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '用戶ID為必填參數'
      });
    }

    const trackings = await flightTracker.getUserTrackings(userId);
    
    res.json({
      success: true,
      data: {
        trackings,
        count: trackings.length
      }
    });
  } catch (error) {
    console.error('Get trackings error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '獲取追蹤列表時發生錯誤'
    });
  }
});

// 移除追蹤
router.delete('/trackings/:userId/:subscriptionId', async (req, res) => {
  try {
    const { userId, subscriptionId } = req.params;
    
    if (!userId || !subscriptionId) {
      return res.status(400).json({
        success: false,
        error: '用戶ID和訂閱ID為必填參數'
      });
    }

    const result = await flightTracker.removeTracking(userId, subscriptionId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Remove tracking error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '移除追蹤時發生錯誤'
    });
  }
});

// 獲取價格分析
router.get('/analysis/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    
    if (!routeId) {
      return res.status(400).json({
        success: false,
        error: '路線ID為必填參數'
      });
    }

    const analysis = await flightTracker.getPriceAnalysis(routeId);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Get price analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '獲取價格分析時發生錯誤'
    });
  }
});

// 獲取機場建議
router.get('/airports/suggest', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: '查詢參數為必填欄位'
      });
    }

    const suggestions = await flightTracker.getAirportSuggestions(query);
    
    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length
      }
    });
  } catch (error) {
    console.error('Get airport suggestions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '獲取機場建議時發生錯誤'
    });
  }
});

// 手動觸發價格檢查 (管理員功能)
router.post('/admin/check-prices', async (req, res) => {
  try {
    await flightTracker.runPriceCheck();
    
    res.json({
      success: true,
      message: '價格檢查已啟動'
    });
  } catch (error) {
    console.error('Manual price check error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '啟動價格檢查時發生錯誤'
    });
  }
});

// 手動觸發警報檢查 (管理員功能)
router.post('/admin/check-alerts', async (req, res) => {
  try {
    await flightTracker.checkAndSendAlerts();
    
    res.json({
      success: true,
      message: '警報檢查已啟動'
    });
  } catch (error) {
    console.error('Manual alert check error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '啟動警報檢查時發生錯誤'
    });
  }
});

// 獲取系統統計
router.get('/admin/stats', async (req, res) => {
  try {
    const stats = await flightTracker.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '獲取統計數據時發生錯誤'
    });
  }
});

// 清理過期追蹤 (管理員功能)
router.post('/admin/cleanup', async (req, res) => {
  try {
    await flightTracker.cleanupExpiredTrackings();
    
    res.json({
      success: true,
      message: '過期追蹤清理完成'
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '清理過期追蹤時發生錯誤'
    });
  }
});

// 健康檢查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '機票追蹤服務運行正常',
    timestamp: new Date().toISOString()
  });
});

export default router;