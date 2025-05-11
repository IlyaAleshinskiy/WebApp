const express = require('express');
const userRouter = require('./routes/user.routes');
const bcrypt = require('bcrypt');
const { pool } = require('./DataBase'); // Библиотека для работы с хэшированием паролей
const PORT = process.env.PORT || 8080;

const app = express();

// Поддержка статических файлов
app.use(express.static('public'));

// Middleware для JSON
app.use(express.json());

// Роутинг API
app.use('/api', userRouter);

// Страницы
app.get('/main', (req, res) => {res.sendFile(__dirname + '/public/index.html');});
app.get('/booking', (req, res) => {res.sendFile(__dirname + '/public/booking.html');});
app.get('/register', (req, res) => {res.sendFile(__dirname + '/public/register.html');});
app.get('/login', (req, res) => {res.sendFile(__dirname + '/public/login.html');});

// API для бронирования
app.post('/api/booking', (req, res) => {
  const { type_, in_, out_, name_ } = req.body;

  if (!type_ || !in_ || !out_ || !name_) {
    return res.status(400).json({ success: false, message: 'Необходимо заполнить все поля.' });
  }

  // Здесь можно добавить логику проверки наличия номера
  const bookingSuccess = true; // Пример успешного бронирования

  if (bookingSuccess) {
    res.json({ success: true, message: 'Номер успешно забронирован!' });
  } else {
    res.json({ success: false, message: 'Нет свободных номеров на выбранные даты.' });
  }
});


//Авторизация
app.post('/api/login', async (req, res) => {});

// Запуск сервера
app.listen(PORT, () => console.log(`Сервак запущен на порту ${PORT}`));