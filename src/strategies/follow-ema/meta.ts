import { reportPlugin } from '@debut/plugin-report';
import { debugPlugin } from '@debut/plugin-debug';
import { createSessionValidator } from '@debut/plugin-session';
import { BaseTransport, DebutMeta, GeneticSchema, WorkingEnv } from '@debut/types';
import { FollowEMABot, FollowEMAOptions } from './bot';

export const parameters: GeneticSchema<FollowEMAOptions> = {
  stopLoss: { min: 0.2, max: 9 },
  takeProfit: { min: 0.2, max: 9 },
  openPercent: { min: 1, max: 15 },
  fastPeriod: { min: 2, max: 100, int: true },
  slowPeriod: { min: 10, max: 100, int: true },
};

const meta: DebutMeta = {
  parameters,

  score(bot: FollowEMABot) {
    const report = bot.plugins.stats.report();

    return report.expectation;
  },

  stats(bot: FollowEMABot) {
    return bot.plugins.stats.report();
  },

  async create(transport: BaseTransport, cfg: FollowEMAOptions, env: WorkingEnv) {
    const bot = new FollowEMABot(transport, cfg);

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

  ticksFilter(cfg: FollowEMAOptions) {
    if (!cfg.from && !cfg.to) {
      return () => true;
    }

    const tickValidator = createSessionValidator(cfg.from, cfg.to, cfg.noTimeSwitching);

    return (tick) => {
      return tickValidator(tick.time).inSession;
    };
  },

  validate(cfg: FollowEMAOptions) {
    if (cfg.fastPeriod > cfg.slowPeriod) {
      return false;
    }

    return cfg;
  },
};

export default meta;
