const {pool} = require('../DataBase')
const bcrypt = require('bcrypt');
const { log } = require('debug');
const res = require('express/lib/response');
function isDigitsOnly(value) {
  return /^\d+$/.test(value);
}
let globalClientLogin;
let globalWorkerLogin;
class UserController {
// Бронь
  async newApplication(req, res) {
    try {
      const { type_room, client_phone, basic_seats, additional_seats, date_in, date_out } = req.body;

      // Проверяем входные данные
      if (!type_room || !additional_seats || !basic_seats || !date_in || !date_out) {
        return res.status(400).json({ error: 'Все поля обязательны' });
      }
      // Форматируем даты
      function formatDate(dateString) {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      }

      // Проверяем свободные номера
      const result = await pool.query(
        `WITH free_rooms AS (
            SELECT room.id_room
            FROM room
                     JOIN type_room ON room.id_type_room = type_room.id_type_room
            WHERE room.id_room NOT IN (
                SELECT application.id_room
                FROM application
                WHERE application.id_status IN (0,1) -- Бронь или заселен
                  AND ((application.date_in <= $2 AND application.date_out > $1))
            )
              AND type_room.id_type_room = $3 -- Фильтр по типу номера
        )
         SELECT id_room FROM free_rooms LIMIT 1;`,
        [formatDate(date_in), formatDate(date_out), type_room]
      );

      if (result.rows[0] === undefined || result.rows[0].id_room === undefined) {
        return res.status(404).json({ error: 'Свободных номеров нет на указанный период' });
      }
      // Получение id клиента по номеру телефона
      const id_Client = await pool.query("SELECT id_client FROM client WHERE phone = $1", [client_phone]);
      const idClient = id_Client.rows[0].id_client;
      if (idClient === undefined) {
        return res.status(404).json({ error: 'Клиент с таким номером телефона не найден' });
      }
      // Получение цены
      const price = await pool.query("SELECT cost_basic_seat, cost_additional_seat FROM tariff JOIN type_room ON type_room.id_type_room = tariff.id_type_room WHERE type_room.id_type_room = $1", [type_room])
      // Извлечение данных из первой строки
      const { cost_basic_seat, cost_additional_seat } = price.rows[0];
      const dateIn = new Date(date_in); // Дата заезда
      const dateOut = new Date(date_out); // Дата выезда
      // Разница в миллисекундах
      const timeDifference = dateOut - dateIn;
      // Переводим миллисекунды в дни
      const days = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
      const price_application = ((Number(cost_basic_seat) * Number(basic_seats)) + (Number(cost_additional_seat) * Number(additional_seats))) * Number(days);

      // Создаем заявку на бронирование
      const newBooking = await pool.query("INSERT INTO application (id_room, id_client, additional_seats, basic_seats, date_in, date_out, price_application) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;",
        [result.rows[0].id_room, idClient, additional_seats, basic_seats, date_in, date_out, price_application]
      );
      res.status(201).json({ message: 'Бронь успешно создана', booking: newBooking.rows[0] });
    } catch (error) {
      console.error('Ошибка при создании брони:', error);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }
  // Регистрация
  async registerUser(req, res) {
    try {
      const { userContact, userPassword } = req.body;
      // Проверка входных данных
      if (!userContact || !userPassword) {
        return res.status(400).json({ error: 'Все поля обязательны' });
      }

      // Функции для проверки формата контакта
      const isPhoneNumber = /^\+?\d{10,15}$/.test(userContact); // Проверка номера телефона
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userContact); // Проверка email

      // Определяем тип пользователя
      if (!isPhoneNumber && !isEmail) {
        return res.status(400).json({ error: 'Некорректный формат контакта. Введите номер телефона или email.' });
      }

      // Хэшируем пароль
      const saltRounds = 10; // Количество раундов для bcrypt
      const hashedPassword = await bcrypt.hash(userPassword, saltRounds);

      if (isPhoneNumber) {
        // Добавляем обычного пользователя в таблицу users
        const newClient = await pool.query(
          "INSERT INTO client (phone, password) VALUES ($1, $2) RETURNING *",
          [userContact, hashedPassword]
        );
        res.status(201).json({ message: 'Пользователь успешно зарегистрирован', user: newClient.rows[0] });
      } else if (isEmail) {
        // Добавляем сотрудника в таблицу employees
        const Worker = await pool.query("SELECT * FROM worker WHERE email = $1", [userContact]);
        if (Worker.rows.length === 0) {
          return res.status(400).json({ error: 'Такого сотрудника нет' });
        }
        const newEmployee = await pool.query(
        "UPDATE worker SET password = $2 WHERE email = $1 RETURNING*",
          [userContact, hashedPassword]
      );
        res.status(201).json({ message: 'Сотрудник успешно зарегистрирован', employee: newEmployee.rows[0] });
      }
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }
  //Данные клиента после регистрации
  async clientData(req, res) {
    try{
      const{ clientSurname, clientName, clientPatronymic, clientBirthday, clientSerialPassport, clientNumberPassport, clientPhone } = req.body;
      // Проверка входных данных
      if (!clientSurname || !clientName || !clientPatronymic || !clientBirthday || !clientSerialPassport || !clientNumberPassport || !clientPhone) {
        return res.status(400).json({ error: 'Все поля обязательны' });
      }
      const newClient = await pool.query(
        "UPDATE client SET surname = $1, name = $2, patronymic = $3, birthday = $4, passport_series = $5, passport_number = $6 WHERE phone = $7 RETURNING *",
        [clientSurname, clientName, clientPatronymic, clientBirthday, clientSerialPassport, clientNumberPassport, clientPhone]
      );
        res.status(201).json({ message: 'Сотрудник успешно зарегистрирован', employee: newClient.rows[0] });
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }
  // Авторизация
  async loginUser(req, res) {
    try {
      const {userEmail, userPassword } = req.body;
      // Ищем пользователя в базе данных
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail); // Проверка email
      if(!isEmail){
        const result = await pool.query("SELECT * FROM client WHERE phone = $1", [userEmail]);
        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Там ничего нет' });
        }
        globalClientLogin = userEmail;
        console.log(result.rows[0]);
        const user = result.rows[0];
        console.log(user);
        // Сравниваем хэшированный пароль с введенным
        const isPasswordValid = await bcrypt.compare(userPassword, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Неверный телефон или пароль' });
        }
      } else {
        const result = await pool.query("SELECT * FROM worker WHERE email = $1", [userEmail]);
        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Там ничего нет' });
        }
        console.log(result.rows[0]);
        const employee = result.rows[0];
        console.log(employee);
        // Сравниваем хэшированный пароль с введенным
        const isPasswordValid = await bcrypt.compare(userPassword, employee.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Неверный email или пароль' });
        }
      }
      res.status(200).json({ message: 'Авторизация успешна' });
    } catch (error) {
      console.error('Ошибка при авторизации:', error);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }

  //Данные о номерах для главной страницы
  async typeRoomIndex(req, res) {
    try {
      // Запрос к базе данных для получения типов номеров
      const result = await pool.query("SELECT * FROM type_room");

      // Преобразуем данные в формат, удобный для фронтенда
      const rooms = result.rows.map((row, index) => ({
        id: row.id_type_room,
        name: row.name,
        basicSeats: row.basic_seats,
        additionalSeats: row.additional_seats,
        image: row.image,
        description: row.description
      }));

      // Отправляем данные в формате JSON
      res.json(rooms);
    } catch (error) {
      console.error('Ошибка при получении данных о номерах:', error);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }
  //Получение заявки
  async getApplication(req, res) {
    try {
      // Запрос к базе данных
      const result = await pool.query(`SELECT * FROM application 
                    INNER JOIN client ON application.id_client = client.id_client  
                    WHERE application.id_status = 0`);
      const applications = result.rows.map((row, index) => ({
        id: row.id_application, // Уникальный id
        fullName: `${row.surname} ${row.name} ${row.patronymic || ''}`.trim(), // ФИО клиента
        room: row.id_room,
        additional_seat: row.additional_seats,
        basic_seat: row.basic_seats,
        in: row.date_in,
        out: row.date_out
      }))

      res.json(applications);
    } catch (error) {
      console.error('Ошибка при получении заявок:', error);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }
  //Обновление заявки
  async updateApplication(req, res) {
    try {
      const { id, id_status, workerEmail } = req.body;

      // Логирование входных данных
      console.log('Входные данные:', { id, id_status, workerEmail });

      // Валидация данных
      if (!id || !id_status || !workerEmail) {
        return res.status(400).json({ error: 'Все поля обязательны' });
      }
      globalWorkerLogin = workerEmail
      // Получаем ID сотрудника по email
      const worker = await pool.query(
        "SELECT id_worker FROM worker WHERE email = $1",
        [workerEmail]
      );

      // Логирование результата запроса
      console.log('Результат запроса сотрудника:', worker.rows);

      // Проверяем, что сотрудник найден
      if (worker.rows.length === 0) {
        return res.status(404).json({ error: 'Сотрудник с таким email не найден' });
      }

      const workerId = worker.rows[0].id_worker;

      // Обновляем статус заявки
      await pool.query(
        "UPDATE application SET id_status = $1, id_worker = $2 WHERE id_application = $3",
        [id_status, workerId, id]
      );

      // Возвращаем успешный ответ
      res.json({ message: 'Статус заявки успешно обновлен', id_status });
    } catch (error) {
      console.error('Ошибка при обновлении статуса заявки:', error.message);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }
  // Данные о типах для брони
  async typeRoomBooking(req, res) {
    try {
      const result = await pool.query('SELECT id_type_room, name, additional_seats, basic_seats FROM type_room');

      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Ошибка при получении типов номеров:', error);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }
  //Показ истории заявок клиента
  async clientApplication(req, res) {
    try {

      // Получаем ID пользователя по телефону
      const userResult = await pool.query('SELECT id_client FROM client WHERE phone = $1', [globalClientLogin]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const userId = userResult.rows[0].id_client;

      // Получаем заявки пользователя
      const result = await pool.query('SELECT * FROM application JOIN client ON application.id_client = client.id_client WHERE client.id_client = $1 ORDER BY id_application', [userId]);
      const applications = result.rows.map((row) => ({
        id: row.id_application,
        room: row.id_room,
        additional_seat: row.additional_seats,
        basic_seat: row.basic_seats,
        in: row.date_in,
        out: row.date_out,
        status: row.id_status,
        name: row.name,
        surname: row.surname,
        patronymic: row.patronymic,
        birthday: row.birthday,
        passport_series: row.passport_series,
        passport_number: row.passport_number,
        phone: row.phone
      }));
      console.log(applications);
      res.status(200).json(applications);
    } catch (error) {
      console.error('Ошибка при получении заявок:', error.message);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }

  //Отказ от заявки
  async rejectApplication(req, res) {
    try {
      const { id_application, id_status } = req.body;

      // Проверяем, что данные переданы
      if (!id_application || id_status === undefined) {
        return res.status(400).json({ error: 'Необходимо указать id_application и id_status' });
      }

      // Обновляем статус заявки
      const result = await pool.query('UPDATE application SET id_status = $1 WHERE id_application = $2', [id_status, id_application]);

      // Проверяем, что запись была обновлена
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      // Отправляем успешный ответ
      res.status(200).json({ message: 'Статус заявки успешно обновлен' });
    } catch (error) {
      console.error('Ошибка при обновлении статуса заявки:', error.message);
      res.status(500).json({ error: 'Произошла ошибка на сервере' });
    }
  }

  //Доп услуги
  async getServices(req, res) {
    try {
      const result = await pool.query('SELECT * FROM service');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Ошибка загрузки услуг' });
    }
  }
  async postServices(req, res) {
    const { id_application, services } = req.body;

    if (!Array.isArray(services)) {
      return res.status(400).json({ error: "Неверный формат данных" });
    }

    try {
      // Вставляем все услуги
      for (const serviceId of services) {
        await pool.query(
          'INSERT INTO rendered_service(id_application, id_service) VALUES ($1, $2)',
          [id_application, serviceId]
        );
      }

      // 1. Получаем данные по заявке (включая даты)
      const appResult = await pool.query(`
            SELECT date_in, date_out, price_application FROM application
            WHERE id_application = $1`,
        [id_application]
      );

      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      const { date_in, date_out, price: currentPrice } = appResult.rows[0];

      // 2. Вычисляем количество дней
      const inDate = new Date(date_in);
      const outDate = new Date(date_out);
      const days = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24)); // разница в днях

      // 3. Получаем стоимость услуг за день
      const servicesResult = await pool.query(`
            SELECT price FROM service
            WHERE id_service = ANY($1)`,
        [services] // Исправлено: передаем массив services, а не id
      );

      const dailyServicePrice = servicesResult.rows.reduce((sum, row) => sum + row.price, 0);
      const totalServicePrice = dailyServicePrice * days;

      // 4. Обновляем цену заявки
      const newPrice = (currentPrice ? parseFloat(currentPrice) : 0) + parseFloat(totalServicePrice);


      await pool.query(
        `UPDATE application SET price_application = $1 WHERE id_application = $2`,
        [newPrice, id_application]
      );

      res.sendStatus(200);
    } catch (err) {
      console.error(err); // Логируем ошибку для отладки
      res.status(500).json({ error: "Не удалось сохранить услуги" });
    }
  }
}


module.exports = new UserController();