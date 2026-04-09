import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import env from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, '../../logs');

fs.mkdirSync(logsDir, { recursive: true });

const lineFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.splat()
);

const logger = createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: env.APP_NAME },
  transports: [
    new transports.Console({
      format: format.combine(
        lineFormat,
        env.NODE_ENV === 'production'
          ? format.json()
          : format.combine(format.colorize(), format.simple())
      )
    }),
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: '30d',
      format: format.combine(lineFormat, format.json())
    })
  ]
});

export default logger;
