const Pool = require('pg').Pool; //require('pg') — это импорт библиотеки pg,
// которая предоставляет инструменты для взаимодействия с базой данных PostgreSQL.
const pool = new Pool({ // Этот объект будет использоваться для выполнения SQL-запросов к базе данных.
  user: "ilyaleshinskiy", // Логин админа
  password: "171003123qQ!", // Пароль админа БД
  host: "localhost", //
  port: 5433, // Порт, где находится БД
  database: "Hotel" // Название базы данных
})


module.exports = {pool};