const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const mercadopago = require("mercadopago");

const TOKEN = "8741185680:AAGj98b2sOlYSW7prpg4FLYRmtah60iY9qI";
const bot = new TelegramBot(TOKEN, { polling: true });

// ================= MERCADO PAGO =================
mercadopago.configure({
  access_token: "APP_USR-6208774874996192-042016-e2a2cd74b41e33563f1372f78c9b3e8d-3091695226"
});

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
function gerarRef() {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CASHIN-${random}-${Date.now()}`;
}

function gerarId() {
  return Math.floor(100000 + Math.random() * 900000);
}

// ================= TECLADO INLINE (MANTIDO IGUAL) =================
function tecladoMenu() {
  return {
    inline_keyboard: [
      [{ text: "💰 Depositar (PIX)", callback_data: "depositar" }],
      [{ text: "💸 Sacar", callback_data: "sacar" }],
      [{ text: "📊 Ver Saldo", callback_data: "saldo" }],
      [{ text: "🔗 Link de Afiliado", callback_data: "afiliado" }],
      [{ text: "📄 Termos de Uso", callback_data: "termos" }],
      [{ text: "📞 Suporte", callback_data: "suporte" }]
    ]
  };
}

// ================= START (NÃO MEXI) =================
bot.onText(/\/start/, (msg) => {
  const id = msg.chat.id;

  users[id] = { step: "ASK_NAME" };
  saveUsers();

  bot.sendPhoto(id, "welcome.png", {
    caption: `👋 Bem-vindo ao PIX ANÔNIMO!

Para começarmos, me diga seu nome fictício completo 👇`
  });
});


// ================= 🔥 PIX REAL (ALTERADO AQUI) =================
bot.onText(/\/pix (.+)/, async (msg, match) => {
  const id = msg.chat.id;

  if (!users[id] || users[id].step !== "MENU") {
    return bot.sendMessage(id, "Finalize seu cadastro primeiro com /start");
  }

  const valor = parseFloat(match[1]);

  if (isNaN(valor) || valor <= 0) {
    return bot.sendMessage(id, "Valor inválido.");
  }

  try {
    const payment = await mercadopago.payment.create({
      transaction_amount: valor,
      description: "Depósito no bot",
      payment_method_id: "pix",
      payer: {
        email: users[id].email || `user${id}@email.com`
      }
    });

    const qrCode = payment.body.point_of_interaction.transaction_data.qr_code;
    const qrBase64 = payment.body.point_of_interaction.transaction_data.qr_code_base64;

    payments[payment.body.id] = {
      userId: id,
      value: valor
    };

    bot.sendPhoto(
      id,
      Buffer.from(qrBase64, "base64"),
      {
        caption: `✅ PIX gerado com sucesso!

💰 Valor: R$${valor.toFixed(2)}
🔑 Copia e cola:
${qrCode}

⏳ Status: PENDENTE

📌 Aguarde confirmação automática.`
      }
    );

  } catch (err) {
    console.log(err);
    bot.sendMessage(id, "Erro ao gerar PIX. Tente novamente.");
  }
});


// ================= BOTÕES (NÃO MEXI) =================
bot.on("callback_query", (query) => {
  const id = query.message.chat.id;
  const data = query.data;
  const user = users[id];

  if (!user) return;

  if (data === "depositar") {
    bot.sendMessage(id, "💸 Para depositar, digite /pix <valor> (ex.: /pix 100.00)");
  }

  if (data === "saldo") {
    bot.sendMessage(id, `💰 Saldo: R$${user.saldo.toFixed(2)}\n📊 Transações: ${user.transacoes}`);
  }

  if (data === "sacar") {
    bot.sendMessage(id, "🚧 Você não possui valores para saque.");
  }

  if (data === "afiliado") {
    const link = `https://t.me/pixanonimoofc_bot?start=${id}`;
    bot.sendMessage(id, `🔗 Seu link:\n${link}`);
  }

  if (data === "termos") {
    bot.sendMessage(id, "📄 Em desenvolvimento.");
  }

  if (data === "suporte") {
    bot.sendMessage(id, "📞 Suporte: @erwan_lr");
  }

  bot.answerCallbackQuery(query.id);
});


// ================= FLUXO (NÃO MEXI) =================
bot.on("message", (msg) => {
  const id = msg.chat.id;
  const text = msg.text;

  if (!users[id]) return;
  if (text.startsWith("/")) return;

  const user = users[id];

  if (user.step === "ASK_NAME") {
    user.nome = text;
    user.step = "ASK_CPF";

    return bot.sendMessage(id, `📋 Perfeito! Agora envie seu CPF.

Apenas números (ex: 12345678900).`);
  }

  if (user.step === "ASK_CPF") {
    if (!/^\d{11}$/.test(text)) {
      return bot.sendMessage(id, "CPF inválido.");
    }

    user.cpf = text;
    user.step = "ASK_EMAIL";

    return bot.sendMessage(id, `📧 Quase lá! Envie seu e-mail.`);
  }

  if (user.step === "ASK_EMAIL") {
    user.email = text;

    user.idInterno = gerarId();
    user.saldo = 0;
    user.transacoes = 0;
    user.step = "MENU";

    return bot.sendPhoto(id, "final.png", {
      caption: `🎉 Cadastro concluído com sucesso, ${user.nome}!

🆔 ID: ${user.idInterno}
💰 Saldo: R$0.00
📊 Transações: 0

💡 Taxa de 5% nos depósitos.`,
      reply_markup: tecladoMenu()
    });
  }

  saveUsers();
});

console.log("🤖 Bot rodando...");
