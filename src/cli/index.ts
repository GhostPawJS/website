import { defineCommand, runMain } from 'citty';
import buildCmd from './commands/build.ts';
import checkCmd from './commands/check.ts';
import configCmd from './commands/config.ts';
import deployCmd from './commands/deploy.ts';
import devCmd from './commands/dev.ts';
import initCmd from './commands/init.ts';
import newCmd from './commands/new.ts';
import startCmd from './commands/start.ts';

const main = defineCommand({
	meta: {
		name: 'website',
		version: '0.2.1',
		description: 'LLM-native static site builder — build, check fitness, deploy',
	},
	subCommands: {
		init: initCmd,
		dev: devCmd,
		build: buildCmd,
		check: checkCmd,
		new: newCmd,
		config: configCmd,
		deploy: deployCmd,
		start: startCmd,
	},
});

runMain(main);
