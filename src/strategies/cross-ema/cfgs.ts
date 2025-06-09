import { CrossEMAOptions } from './bot';

export const TSLA: CrossEMAOptions = {
    broker: 'tinkoff',
    ticker: 'TSLA',
    currency: 'USD',
    interval: 'day',
    stopLoss: 100,
    takeProfit: 100,
    amount: 10000,
    fastPeriod: 10,
    slowPeriod: 20,
    openPercent: 10,
    fee: 0.1,
    id: 25,
};

// export const IMOEX: CrossEMAOptions = {
//     broker: 'tinkoff',
//     ticker: 'IMOEX',
//     currency: 'USD',
//     interval: 'day',
//     stopLoss: 100,
//     takeProfit: 100,
//     amount: 10000,
//     fastPeriod: 10,
//     slowPeriod: 20,
//     openPercent: 10,
//     fee: 0.1,
//     id: 25,
// };
