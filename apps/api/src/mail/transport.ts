import nodemailer from "nodemailer";
import { mailConfig } from "./config";

const transport = mailConfig.enabled ? nodemailer.createTransport({
  host: mailConfig.host, port: mailConfig.port, secure: mailConfig.secure, requireTLS: mailConfig.requireTLS,
  auth: mailConfig.auth, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
  disableFileAccess: true, disableUrlAccess: true,
  tls: { minVersion: "TLSv1.2", rejectUnauthorized: true }
}) : null;

export async function sendPasswordReset(to: string, url: string) {
  if (!transport || !mailConfig.enabled) throw new Error("Mail disabled");
  const result = await transport.sendMail({
    from: { name: "ZORIA ASTROPROCESSOR", address: mailConfig.from }, to,
    subject: "ZORIA: відновлення пароля",
    text: `Для зміни пароля відкрийте посилання:\n\n${url}\n\nПосилання одноразове й діє до 30 хвилин від запиту. Якщо ви не просили змінити пароль, ігноруйте цей лист. Ваш пароль не зміниться без підтвердження.\n\nZORIA ASTROPROCESSOR`
  });
  if (!result.accepted.length) throw new Error("Mail not accepted");
}
