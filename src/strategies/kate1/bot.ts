import { Debut } from '@debut/community-core';
import { EMA } from '@debut/indicators';
import { IndicatorsSchema, ReportPluginAPI } from '@debut/plugin-report';
import { sessionPlugin, SessionPluginOptions } from '@debut/plugin-session';
import { statsPlugin, StatsPluginAPI } from '@debut/plugin-stats';
import { VirtualTakesOptions, virtualTakesPlugin } from '@debut/plugin-virtual-takes';
import { BaseTransport, Candle, DebutOptions, OrderType } from '@debut/types';

export interface Kate1Options extends DebutOptions, SessionPluginOptions, VirtualTakesOptions {
    // Не нужны дополнительные опции для данной стратегии
}

export class Kate1Bot extends Debut {
    declare plugins: StatsPluginAPI & ReportPluginAPI;

    private ema20: EMA;
    private ema50: EMA;

    private ema20Result: number[] = [];
    private ema50Result: number[] = [];

    private stopLoss: number = 0;
    private entryPrice: number = 0;
    private isTrailingStop: boolean = false;

    constructor(transport: BaseTransport, public opts: Kate1Options) {
        super(transport, opts);

        this.ema20 = new EMA(20);
        this.ema50 = new EMA(50);

        this.registerPlugins([
            this.opts.from && this.opts.to && sessionPlugin(this.opts),
            virtualTakesPlugin(this.opts),
            statsPlugin(this.opts),
        ]);
    }

    public getIndicators(): IndicatorsSchema {
        return [
            {
                name: 'EMA',
                figures: [
                    {
                        name: 'EMA20',
                        getValue: () => {
                            return this.ema20Result[0];
                        },
                    },
                    {
                        name: 'EMA50',
                        getValue: () => {
                            return this.ema50Result[0];
                        },
                    },
                ],
                inChart: true,
            },
        ];
    }

    async onCandle(candle: Candle) {
        try {
            const { c: price } = candle;
            // Вычисляем значения EMA
            const ema20Values = this.getEMA20(price);
            const ema50Values = this.getEMA50(price);

            // Проверяем, есть ли достаточно данных для анализа
            if (ema20Values.length < 2 || ema50Values.length < 2) {
                return;
            }

            const currentOrder = this.orders[0];
            // Проверяем стоп-лоссы
            if (currentOrder) {
                await this.checkStopLoss(price, currentOrder, ema50Values[0]);
            }

            // Если нет активного ордера, ищем точки входа
            if (!currentOrder) {
                await this.checkEntrySignals(price, ema20Values, ema50Values);
            }
        } catch (e) {
            console.log(this.getName(), e);
        }
    }

    private async checkStopLoss(currentPrice: number, order: any, currentEMA50: number) {
        const spreadPercent = Math.abs((this.ema20Result[0] - this.ema50Result[0]) / this.ema50Result[0]) * 100;

        // Определяем тип стоп-лосса на основе спреда
        if (spreadPercent >= 3) {
            // При спреде 3% и выше - стоп на -3% от EMA20
            if (order.type === OrderType.BUY) {
                this.stopLoss = this.ema20Result[0] * 0.97; // -3% от EMA20
                if (currentPrice <= this.stopLoss) {
                    await this.closeOrder(order);
                    this.resetPosition();
                }
            } else {
                this.stopLoss = this.ema20Result[0] * 1.03; // +3% от EMA20
                if (currentPrice >= this.stopLoss) {
                    await this.closeOrder(order);
                    this.resetPosition();
                }
            }
        } else if (spreadPercent >= 2) {
            // При спреде 2-3% - стоп на -3% от EMA50
            if (order.type === OrderType.BUY) {
                this.stopLoss = currentEMA50 * 0.97; // -3% от EMA50
                if (currentPrice <= this.stopLoss) {
                    await this.closeOrder(order);
                    this.resetPosition();
                }
            } else {
                this.stopLoss = currentEMA50 * 1.03; // +3% от EMA50
                if (currentPrice >= this.stopLoss) {
                    await this.closeOrder(order);
                    this.resetPosition();
                }
            }
        } else {
            // При спреде менее 2% - обычный стоп-лосс (-3% от входа)
            if (order.type === OrderType.BUY && currentPrice <= this.stopLoss) {
                await this.closeOrder(order);
                this.resetPosition();
            } else if (order.type === OrderType.SELL && currentPrice >= this.stopLoss) {
                await this.closeOrder(order);
                this.resetPosition();
            }
        }

        // Обновляем флаг трейлинг стопа
        this.isTrailingStop = spreadPercent >= 2;
    }

    private async checkEntrySignals(price: number, ema20Values: number[], ema50Values: number[]) {
        const [ema20Current, ema20Previous] = ema20Values;
        const [ema50Current, ema50Previous] = ema50Values;

        // Сигнал на покупку (лонг) - убрано условие с EMA200
        if (
            ema20Current > ema50Current && // EMA20 пересекла EMA50 снизу вверх
            ema20Previous <= ema50Previous
        ) {
            const newOrder = await this.createOrder(OrderType.BUY);
            this.entryPrice = newOrder.price;
            this.stopLoss = this.entryPrice * 0.95; // -5% от покупки
            this.isTrailingStop = false;
        }

        // Сигнал на продажу (шорт)
        if (
            ema20Current < ema50Current && // EMA20 пересекла EMA50 сверху вниз
            ema20Previous >= ema50Previous
        ) {
            const newOrder = await this.createOrder(OrderType.SELL);
            this.entryPrice = newOrder.price;
            this.stopLoss = this.entryPrice * 1.05; // +5% от продажи
            this.isTrailingStop = false;
        }
    }

    private resetPosition() {
        this.stopLoss = 0;
        this.entryPrice = 0;
        this.isTrailingStop = false;
    }

    private getEMA20(value: number): number[] {
        this.ema20Result.unshift(this.ema20.nextValue(value));
        if (this.ema20Result.length > 2) {
            this.ema20Result.splice(-1);
        }
        return this.ema20Result;
    }

    private getEMA50(value: number): number[] {
        this.ema50Result.unshift(this.ema50.nextValue(value));
        if (this.ema50Result.length > 2) {
            this.ema50Result.splice(-1);
        }
        return this.ema50Result;
    }
}
