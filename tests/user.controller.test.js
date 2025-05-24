// __tests__/user.controller.test.js

const request = require('supertest');
const express = require('express');
const UserController = require('../controller/user.controller'); // Убедись, что путь правильный
const { pool } = require('../DataBase');

// Мокаем pool.query
jest.mock('../DataBase', () => ({
  pool: {
    query: jest.fn()
  }
}));

const app = express();
app.use(express.json());
app.use('/api', require('../routes/user.routes'));

describe("Модульное тестирование серверной части", () => {

  beforeEach(() => {
    jest.clearAllMocks(); // Очищаем предыдущие вызовы перед каждым тестом
  });

  // === Тест 1: newApplication - успешное бронирование ===
  test("должен успешно забронировать номер", async () => {
    const mockFreeRoom = { rows: [{ id_room: 101 }] };
    const mockClient = { rows: [{ id_client: 1 }] };
    const mockTariff = { rows: [{ cost_basic_seat: 2000, cost_additional_seat: 1000 }] };
    const mockInsert = { rows: [{ id_application: 1 }] };

    pool.query
      .mockResolvedValueOnce(mockFreeRoom) // свободные номера
      .mockResolvedValueOnce(mockClient)   // поиск клиента
      .mockResolvedValueOnce(mockTariff)   // тарифы
      .mockResolvedValueOnce(mockInsert); // вставка брони

    const response = await request(app)
      .post('/api/booking')
      .send({
        type_room: '1',
        client_phone: '+79876543210',
        basic_seats: '2',
        additional_seats: '1',
        date_in: '2025-04-05',
        date_out: '2025-04-10'
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Бронь успешно создана');
    expect(pool.query).toHaveBeenCalledTimes(4); // 4 SQL-запроса
  });

  // === Тест 2: newApplication - нет свободных номеров ===
  test("должен вернуть ошибку при отсутствии свободных номеров", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // нет свободных номеров

    const response = await request(app)
      .post('/api/booking')
      .send({
        type_room: '1',
        basic_seats: '2',
        additional_seats: '1',
        date_in: '2025-04-05',
        date_out: '2025-04-10'
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Свободных номеров нет на указанный период');
  });

  // === Тест 3: registerUser - регистрация клиента по телефону ===
  test("должен зарегистрировать нового клиента по телефону", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ phone: '+79876543210' }] });

    const response = await request(app)
      .post('/api/register')
      .send({
        userContact: '+79876543210',
        userPassword: 'password123'
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Пользователь успешно зарегистрирован');
  });

  // === Тест 4: loginUser - вход клиента по телефону ===
  test("должен войти как клиент с корректными данными", async () => {
    const mockClient = {
      rows: [{
        phone: '+79876543210',
        password: '$2b$10$mockedHashedPassword', // хеш пароля
        surname: 'Иванов',
        name: 'Иван',
        patronymic: 'Иванович',
        passport_series: '1234',
        passport_number: '567890',
        birthday: '1990-01-01'
      }]
    };

    // Мокаем bcrypt.compare
    jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

    pool.query.mockResolvedValueOnce(mockClient);

    const response = await request(app)
      .post('/api/login')
      .send({
        userEmail: '+79876543210',
        userPassword: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Авторизация успешна');
    expect(global.globalClientLogin).toBe('+79876543210');
  });


  // === Тест 5: clientApplication - получение истории заявок ===
  test("должен получить историю заявок клиента", async () => {
    global.globalClientLogin = '+79876543210';

    pool.query
      .mockResolvedValueOnce({ rows: [{ id_client: 1 }] })
      .mockResolvedValueOnce({ rows: [
          {
            id_application: 1,
            surname: 'Иванов',
            name: 'Иван',
            patronymic: 'Иванович',
            phone: '+79876543210',
            date_in: '2025-04-05',
            date_out: '2025-04-10',
            id_status: 1
          }
        ]});

    const response = await request(app).get('/api/client_application');

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].id).toBe(1);
  });

  // === Тест 6: rejectApplication - отмена заявки ===
  test("должен отменить заявку", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 }); // имитируем успешное обновление

    const response = await request(app)
      .put('/api/cancel_application')
      .send({
        id_application: 1,
        id_status: 3
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Статус заявки успешно обновлен');
  });

  // === Тест 7: getServices - получение списка услуг ===
  test("должен получить список всех доп. услуг", async () => {
    const mockServices = {
      rows: [
        { id_service: 1, name: "Завтрак", price: 300 },
        { id_service: 2, name: "Wi-Fi", price: 100 }
      ]
    };

    pool.query.mockResolvedValueOnce(mockServices);

    const response = await request(app).get('/api/get_services');

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(2);
    expect(response.body[0].name).toBe('Завтрак');
    expect(response.body[1].price).toBe(100);
  });

  // === Тест 8: typeRoomIndex - получение типов номеров ===
  test("должен получить список типов номеров", async () => {
    const mockTypes = {
      rows: [
        { id_type_room: 1, name: "Стандарт", basic_seats: 2, additional_seats: 1 },
        { id_type_room: 2, name: "Люкс", basic_seats: 2, additional_seats: 2 }
      ]
    };

    pool.query.mockResolvedValueOnce(mockTypes);

    const response = await request(app).get('/api/type_room');

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(2);
    expect(response.body[1].name).toBe('Люкс');
  });

  // === Тест 9: clientData - заполнение данных клиента после регистрации ===
  test("должен обновить данные клиента", async () => {
    const mockUpdatedClient = {
      rows: [{
        surname: 'Петров',
        name: 'Иван',
        patronymic: 'Иванович',
        birthday: '1990-01-01',
        passport_series: '1234',
        passport_number: '567890',
        phone: '+79876543210'
      }]
    };

    pool.query.mockResolvedValueOnce(mockUpdatedClient);

    const response = await request(app)
      .post('/api/client_data')
      .send({
        clientSurname: 'Петров',
        clientName: 'Иван',
        clientPatronymic: 'Иванович',
        clientBirthday: '1990-01-01',
        clientSerialPassport: '1234',
        clientNumberPassport: '567890',
        clientPhone: '+79876543210'
      });

    expect(response.status).toBe(201);
    expect(response.body.employee.surname).toBe('Петров');
  });
});