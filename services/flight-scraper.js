import axios from 'axios';
import cheerio from 'cheerio';
import puppeteer from 'puppeteer';

class FlightScraper {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // 搜尋機票 - 主要入口點
  async searchFlights(searchParams) {
    const { origin, destination, departureDate, returnDate, passengers = 1 } = searchParams;
    
    console.log(`Searching flights: ${origin} → ${destination}, ${departureDate}`);
    
    const results = [];
    
    try {
      // 嘗試多個資料來源
      const sources = [
        () => this.searchSkyscanner(searchParams),
        () => this.searchKayak(searchParams),
        () => this.searchExpedia(searchParams)
      ];

      for (const searchFunction of sources) {
        try {
          const sourceResults = await searchFunction();
          if (sourceResults && sourceResults.length > 0) {
            results.push(...sourceResults);
          }
        } catch (error) {
          console.error(`Error with flight source:`, error.message);
          continue;
        }
      }

      return this.deduplicateResults(results);
    } catch (error) {
      console.error('Error searching flights:', error);
      throw error;
    }
  }

  // Skyscanner 搜尋 (示例實現)
  async searchSkyscanner(searchParams) {
    try {
      const { origin, destination, departureDate, returnDate } = searchParams;
      
      // 模擬 Skyscanner API 呼叫
      // 實際應用中需要註冊 Skyscanner API 或使用網頁抓取
      const mockResults = [
        {
          airline: 'China Airlines',
          price: 15800,
          currency: 'TWD',
          flightTime: '1h 45m',
          stops: 0,
          departureTime: '08:30',
          arrivalTime: '10:15',
          source: 'skyscanner',
          bookingUrl: `https://www.skyscanner.com.tw/...`
        },
        {
          airline: 'EVA Air',
          price: 16200,
          currency: 'TWD',
          flightTime: '1h 50m',
          stops: 0,
          departureTime: '14:20',
          arrivalTime: '16:10',
          source: 'skyscanner',
          bookingUrl: `https://www.skyscanner.com.tw/...`
        }
      ];

      console.log(`Skyscanner found ${mockResults.length} flights`);
      return mockResults;
    } catch (error) {
      console.error('Skyscanner search error:', error);
      return [];
    }
  }

  // Kayak 搜尋
  async searchKayak(searchParams) {
    try {
      const { origin, destination, departureDate } = searchParams;
      
      // 模擬 Kayak 搜尋結果
      const mockResults = [
        {
          airline: 'Tigerair Taiwan',
          price: 12800,
          currency: 'TWD',
          flightTime: '1h 40m',
          stops: 0,
          departureTime: '06:15',
          arrivalTime: '07:55',
          source: 'kayak',
          bookingUrl: `https://www.kayak.com.tw/...`
        },
        {
          airline: 'Starlux Airlines',
          price: 18500,
          currency: 'TWD',
          flightTime: '1h 45m',
          stops: 0,
          departureTime: '19:30',
          arrivalTime: '21:15',
          source: 'kayak',
          bookingUrl: `https://www.kayak.com.tw/...`
        }
      ];

      console.log(`Kayak found ${mockResults.length} flights`);
      return mockResults;
    } catch (error) {
      console.error('Kayak search error:', error);
      return [];
    }
  }

  // Expedia 搜尋
  async searchExpedia(searchParams) {
    try {
      const { origin, destination, departureDate } = searchParams;
      
      // 模擬 Expedia 搜尋結果
      const mockResults = [
        {
          airline: 'AirAsia',
          price: 11500,
          currency: 'TWD',
          flightTime: '1h 35m',
          stops: 0,
          departureTime: '11:45',
          arrivalTime: '13:20',
          source: 'expedia',
          bookingUrl: `https://www.expedia.com.tw/...`
        }
      ];

      console.log(`Expedia found ${mockResults.length} flights`);
      return mockResults;
    } catch (error) {
      console.error('Expedia search error:', error);
      return [];
    }
  }

  // 使用 Puppeteer 進行動態網頁抓取 (示例)
  async scrapeWithPuppeteer(url, selector) {
    let page;
    try {
      const browser = await this.initBrowser();
      page = await browser.newPage();
      
      await page.setUserAgent(this.userAgent);
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // 等待內容載入
      await page.waitForSelector(selector, { timeout: 10000 });
      
      const results = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map(el => el.textContent.trim());
      }, selector);
      
      return results;
    } catch (error) {
      console.error('Puppeteer scraping error:', error);
      return [];
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // 去除重複結果
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(flight => {
      const key = `${flight.airline}-${flight.price}-${flight.departureTime}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // 格式化價格為統一貨幣
  convertPrice(price, fromCurrency, toCurrency = 'TWD') {
    // 簡單的匯率轉換 (實際應用中應使用即時匯率 API)
    const exchangeRates = {
      'USD': { 'TWD': 31.5 },
      'EUR': { 'TWD': 34.2 },
      'JPY': { 'TWD': 0.21 },
      'HKD': { 'TWD': 4.1 },
      'TWD': { 'TWD': 1 }
    };

    if (fromCurrency === toCurrency) {
      return price;
    }

    const rate = exchangeRates[fromCurrency]?.[toCurrency];
    return rate ? Math.round(price * rate) : price;
  }

  // 獲取機場代碼建議
  async getAirportSuggestions(query) {
    // 台灣主要機場
    const airports = [
      { code: 'TPE', name: '桃園國際機場', city: '台北' },
      { code: 'TSA', name: '台北松山機場', city: '台北' },
      { code: 'RMQ', name: '台中清泉崗機場', city: '台中' },
      { code: 'KHH', name: '高雄小港機場', city: '高雄' },
      { code: 'MFK', name: '馬公機場', city: '澎湖' },
      { code: 'KNH', name: '金門機場', city: '金門' },
      { code: 'LZN', name: '南竿機場', city: '馬祖' },
      
      // 國際熱門機場
      { code: 'NRT', name: '成田國際機場', city: '東京' },
      { code: 'HND', name: '羽田機場', city: '東京' },
      { code: 'KIX', name: '關西國際機場', city: '大阪' },
      { code: 'ICN', name: '仁川國際機場', city: '首爾' },
      { code: 'HKG', name: '香港國際機場', city: '香港' },
      { code: 'SIN', name: '樟宜機場', city: '新加坡' },
      { code: 'BKK', name: '蘇萬那普機場', city: '曼谷' },
      { code: 'NRT', name: '成田機場', city: '東京' }
    ];

    const queryLower = query.toLowerCase();
    return airports.filter(airport => 
      airport.code.toLowerCase().includes(queryLower) ||
      airport.name.toLowerCase().includes(queryLower) ||
      airport.city.toLowerCase().includes(queryLower)
    ).slice(0, 10);
  }

  // 驗證搜尋參數
  validateSearchParams(params) {
    const { origin, destination, departureDate } = params;
    
    if (!origin || !destination) {
      throw new Error('起點和終點不能為空');
    }
    
    if (!departureDate) {
      throw new Error('出發日期不能為空');
    }
    
    const depDate = new Date(departureDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (depDate < today) {
      throw new Error('出發日期不能早於今天');
    }
    
    if (origin === destination) {
      throw new Error('起點和終點不能相同');
    }
    
    return true;
  }
}

export default FlightScraper;