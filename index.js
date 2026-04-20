const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mercadopago = require("mercadopago");
const fs = require("fs");

// ================= TOKEN BOT =================
const TOKEN = "8741185680:AAGj98b2sOlYSW7prpg4FLYRmtah60iY9qI";
const bot = new TelegramBot(TOKEN, { polling: true });

// ================= MERCADO PAGO =================
mercadopago.configure({
  access_token: "APP_USR-6208774874996192-042016-e2a2cd74b41e33563f1372f78c9b3e8d-3091695226"
});

// ================= EXPRESS WEBHOOK =================
const app = express();
app.use(express.json());

// ================= BANCO =================
let users = {};
let payments = {};

if (fs.existsSync("users.json")) {
  users = JSON.parse(fs.readFileSync("users.json"));
}

function saveUsers() {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

// ================= FUNÇÕES =================
function gerarId() {
  return Math.floor(100000 + Math.random() * 900000);
}

// ================= BOT =================
bot.onText(/\/start/, (msg) => {
  const id = msg.chat.id;

  if (!users[id]) {
    users[id] = {
      step: "MENU",
      saldo: 0,
      transacoes: 0
    };
    saveUsers();
  }

  bot.sendMessage(id, "👋 Bem-vindo! Use o menu abaixo.");
});

// ================= GERAR PIX REAL =================
bot.onText(/\/pix (.+)/, async (msg, match) => {
  const id = msg.chat.id;
  const valor = parseFloat(match[1]);

  if (!valor || valor <= 0) {
    return bot.sendMessage(id, "Valor inválido.");
  }

  try {
    const payment = await mercadopago.payment.create({
      transaction_amount: valor,
      description: "Depósito no bot",
      payment_method_id: "pix",
      payer: {
        email: "user" + id + "@email.com"
      }
    });

    const qrCode =
      payment.body.point_of_interaction.transaction_data.qr_code;

    const qrBase64 =
      payment.body.point_of_interaction.transaction_data.qr_code_base64;

    payments[payment.body.id] = {
      userId: id,
      value: valor
    };

    bot.sendPhoto(
      id,
      Buffer.from(qrBase64, "base64"),
      {
        caption: `💰 PIX GERADO

💵 Valor: R$${valor.toFixed(2)}

📋 Copia e cola:
${qrCode}

⏳ Aguarde confirmação automática.`
      }
    );
  } catch (err) {
    console.log(err);
    bot.sendMessage(id, "Erro ao gerar PIX.");
  }
});

// ================= WEBHOOK PAGAMENTO =================
app.post("/webhook", (req, res) => {
  const payment = req.body;

  try {
    if (payment.type === "payment") {
      const paymentId = payment.data.id;

      mercadopago.payment
        .get(paymentId)
        .then((result) => {
          const status = result.body.status;

          if (status === "approved") {
            const record = payments[paymentId];

            if (record) {
              const userId = record.userId;
              const value = record.value;

              if (!users[userId]) return;

              users[userId].saldo += value;
              users[userId].transacoes += 1;
              saveUsers();

              bot.sendMessage(
                userId,
                `✅ PAGAMENTO CONFIRMADO!

💰 Valor: R$${value.toFixed(2)}
💳 Novo saldo: R$${users[userId].saldo.toFixed(2)}`
              );
            }
          }
        });
    }

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

// ================= SERVER =================
app.listen(3000, () => {
  console.log("Webhook rodando na porta 3000");
});

console.log("Bot rodando...");