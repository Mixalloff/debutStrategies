import { reportPlugin } from '@debut/plugin-report';
import { debugPlugin } from '@debut/plugin-debug';
import { createSessionValidator } from '@debut/plugin-session';
import { BaseTransport, DebutMeta, GeneticSchema, WorkingEnv } from '@debut/types';
import { Kate1Bot, Kate1Options } from './bot';

export const parameters: GeneticSchema<Kate1Options> = {
    stopLoss: { min: 0.2, max: 9 },
    takeProfit: { min: 0.2, max: 9 },
};

const meta: DebutMeta = {
    parameters,

    score(bot: Kate1Bot) {
        const report = bot.plugins.stats.report();

        return report.expectation;
    },

    stats(bot: Kate1Bot) {
        return bot.plugins.stats.report();
    },

    async create(transport: BaseTransport, cfg: Kate1Options, env: WorkingEnv) {
        const bot = new Kate1Bot(transport, cfg);

        // Environments plugins
        if (env === WorkingEnv.genetic) {
            // nothing here
        } else if (env === WorkingEnv.tester) {
            bot.registerPlugins([reportPlugin(false)]);
            bot.plugins.report.addIndicators(bot.getIndicators());
        } else if (env === WorkingEnv.production) {
            bot.registerPlugins([debugPlugin()]);
        }

        return bot;
    },

    ticksFilter(cfg: Kate1Options) {
        if (!cfg.from && !cfg.to) {
            return () => true;
        }

        const tickValidator = createSessionValidator(cfg.from, cfg.to, cfg.noTimeSwitching);

        return (tick) => {
            return tickValidator(tick.time).inSession;
        };
    },

    validate(cfg: Kate1Options) {
        // Для новой стратегии нет дополнительных проверок
        return cfg;
    },
};

export default meta;
