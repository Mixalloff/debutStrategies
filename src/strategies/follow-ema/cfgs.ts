import { FollowEMAOptions } from './bot';

export const TSLA: FollowEMAOptions = {
    broker: 'tinkoff',
    ticker: 'BABA',
    currency: 'USD',
    interval: 'day',
    stopLoss: 100,
    takeProfit: 100,
    amount: 10000,
    fastPeriod: 200,
    slowPeriod: 14,
    openPercent: 10,
    fee: 0.1,
    id: 25,
    equityLevel: 100,
};
