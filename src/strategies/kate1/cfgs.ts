import { Kate1Options } from './bot';

export const TSLA: Kate1Options = {
    broker: 'tinkoff',
    ticker: 'TSLA',
    currency: 'USD',
    interval: 'day',
    stopLoss: 100,
    takeProfit: 100,
    amount: 1000,
    fee: 0.1,
    id: 25,
    equityLevel: 100_000,
};

export const SBER: Kate1Options = {
    broker: 'tinkoff',
    ticker: 'SBER',
    currency: 'RUB',
    interval: 'day',
    stopLoss: 100,
    takeProfit: 100,
    amount: 100000,
    fee: 0.1,
    id: 25,
    equityLevel: 100_000,
};
