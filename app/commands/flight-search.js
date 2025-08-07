import { TYPE_FLIGHT } from '../../constants/command.js';
import Command from './command.js';
import handleFlightCommand from './flight.js';

export default new Command({
  type: TYPE_FLIGHT,
  label: '搜尋機票',
  text: '/flight',
  reply: async (userId, text) => {
    try {
      const result = await handleFlightCommand(userId, text);
      return result;
    } catch (error) {
      console.error('Flight command error:', error);
      return {
        type: 'text',
        text: '❌ 處理機票命令時發生錯誤，請稍後再試'
      };
    }
  },
  aliases: [
    'flight',
    'flights',
    '機票',
    '航班'
  ]
});