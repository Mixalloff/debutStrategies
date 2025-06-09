import { FTOptions } from './bot';

export const TSLA: FTOptions = {
    broker: 'tinkoff',
    ticker: 'AAPL',
    currency: 'USD',
    interval: 'day',
    stopLoss: 100,
    takeProfit: 100,
    amount: 1000,
    fastPeriod: 10,
    slowPeriod: 18,
    openPercent: 10,
    fee: 0.01,
    id: 25,
};

export const BTCUSDT: FTOptions = {
    instrumentType: 'MARGIN',
    fee: 0.1,
    lotsMultiplier: 1,
    equityLevel: 1,
    broker: 'binance',
    ticker: 'BTCUSDT',
    currency: 'USDT',
    interval: '15min',
    stopLoss: 2.44,
    takeProfit: 8.76,
    amount: 500,
    fastPeriod: 42,
    slowPeriod: 83,
    openPercent: 1.22,
    id: 19,
};
