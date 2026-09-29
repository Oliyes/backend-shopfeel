import 'dotenv/config';

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'development-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxFileSize: Number(process.env.MAX_FILE_SIZE ?? 5 * 1024 * 1024),
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 465),
  smtpSecure: String(process.env.SMTP_SECURE ?? 'true') === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? '',
  passwordResetMinutes: Number(process.env.PASSWORD_RESET_MINUTES ?? 15)
};

export default env;
